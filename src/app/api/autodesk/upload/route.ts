import { readAutodeskTokens } from "@/lib/autodesk";
import path from "node:path";
import { readFile } from "node:fs/promises";

async function fetchAps(url: string, token: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`APS API Error (${response.status}): ${text}`);
    }
    return response.json();
}

async function fetchAssetBufferLocal(fileUrl: string, reqOriginalUrl: string): Promise<ArrayBuffer> {
    // If it's our rewritten generated path, we can read it off disk
    if (fileUrl.startsWith("/api/generated/")) {
        const relativePart = fileUrl.replace("/api/generated/", "");
        const absolutePath = path.join(process.cwd(), "public", "generated", relativePart.replace(/\//g, path.sep));
        const buf = await readFile(absolutePath);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    // If it's a proxy link or absolute
    let url = fileUrl;
    if (url.startsWith("/")) {
        try {
            url = new URL(fileUrl, reqOriginalUrl).href;
        } catch {
            url = `http://localhost:${process.env.PORT || 3000}${fileUrl}`;
        }
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    return await response.arrayBuffer();
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fileUrl, extension } = body;
        if (!fileUrl) return Response.json({ error: "Missing fileUrl" }, { status: 400 });

        const tokens = await readAutodeskTokens();
        if (!tokens?.access_token) return Response.json({ error: "Not connected to Autodesk" }, { status: 401 });

        const token = tokens.access_token;

        const reqOriginalUrl = req.url;

        // 1. Get Hubs
        const hubs: any = await fetchAps("https://developer.api.autodesk.com/project/v1/hubs", token);
        const primaryHub = hubs.data[0];
        if (!primaryHub) throw new Error("No Autodesk Hub found for user");

        // 2. Get Projects (usually AutoCAD Web/Drive has a default personal project)
        const projects: any = await fetchAps(`https://developer.api.autodesk.com/project/v1/hubs/${primaryHub.id}/projects`, token);

        // Attempt to prefer an A360 personal project or AutoCAD Web project
        const project = projects.data.find((p: any) => p.attributes.name.toLowerCase().includes("autocad") || p.attributes.name.toLowerCase().includes("drive")) || projects.data[0];
        if (!project) throw new Error("No projects found inside Autodesk hub");

        // 3. Get Root Folder
        const folders: any = await fetchAps(project.relationships.rootFolder.links.related.href, token);
        const folderId = folders.data.id;

        // 4. Create Storage Location
        const filename = `zennah-export-${Date.now()}.${extension || "stl"}`;
        const storageBody = {
            jsonapi: { version: "1.0" },
            data: {
                type: "objects",
                attributes: { name: filename },
                relationships: {
                    target: {
                        data: { type: "folders", id: folderId }
                    }
                }
            }
        };

        const storageRes: any = await fetchAps(`https://developer.api.autodesk.com/data/v1/projects/${project.id}/storage`, token, {
            method: "POST",
            headers: { "Content-Type": "application/vnd.api+json" },
            body: JSON.stringify(storageBody)
        });

        const objectId = storageRes.data.id;
        const uploadUrl = storageRes.data.relationships.object.data.id; // URN for OSS PUT

        // 5. Upload actual file data to OSS Object
        const fileBuffer = await fetchAssetBufferLocal(fileUrl, reqOriginalUrl);
        const parts = uploadUrl.split("/");
        const bucketKey = parts[parts.length - 2];
        const objectName = parts[parts.length - 1];

        const putRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectName}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Length": fileBuffer.byteLength.toString(),
            },
            body: fileBuffer,
        });
        if (!putRes.ok) throw new Error(`OSS Upload failed: ${await putRes.text()}`);

        // 6. Create the Item Version in Data Management (so it shows up in Drive/AutoCAD)
        const itemBody = {
            jsonapi: { version: "1.0" },
            data: {
                type: "items",
                attributes: {
                    displayName: filename,
                    extension: {
                        type: "items:autodesk.core:File",
                        version: "1.0"
                    }
                },
                relationships: {
                    tip: {
                        data: {
                            type: "versions", id: "1"
                        }
                    },
                    parent: {
                        data: { type: "folders", id: folderId }
                    }
                }
            },
            included: [
                {
                    type: "versions",
                    id: "1",
                    attributes: {
                        name: filename,
                        extension: {
                            type: "versions:autodesk.core:File",
                            version: "1.0"
                        }
                    },
                    relationships: {
                        storage: {
                            data: { type: "objects", id: objectId }
                        }
                    }
                }
            ]
        };

        const itemRes: any = await fetchAps(`https://developer.api.autodesk.com/data/v1/projects/${project.id}/items`, token, {
            method: "POST",
            headers: { "Content-Type": "application/vnd.api+json" },
            body: JSON.stringify(itemBody)
        });

        const urn = itemRes.data.id;

        return Response.json({ success: true, filename, urn });

    } catch (error: any) {
        console.error("Autodesk upload error:", error);
        return Response.json({ error: error.message || "Failed to push to Autodesk" }, { status: 500 });
    }
}
