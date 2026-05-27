import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import Busboy from "busboy";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "不支持的请求格式" },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const result = await new Promise<{
      file: { name: string; buffer: Buffer };
      schemaId: string;
    }>((resolve, reject) => {
      let schemaId = "";
      let fileBuffer: Buffer | null = null;
      let fileName = "";
      let foundSchemaId = false;
      let foundFile = false;

      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => { headers[key] = value; });

      const busboy = Busboy({
        headers,
        limits: { fileSize: 50 * 1024 * 1024 },
      });

      busboy.on("field", (name: string, val: string) => {
        if (name === "schemaId") {
          schemaId = val;
          foundSchemaId = true;
        }
      });

      busboy.on("file", (_fieldname: string, stream: import("stream").Readable, info: { filename: string; encoding: string; mimeType: string }) => {
        const { filename } = info;
        if (!filename) {
          stream.resume();
          return;
        }

        // Validate file type
        const ext = path.extname(filename).toLowerCase();
        if (![".xlsx", ".xls", ".csv"].includes(ext)) {
          stream.resume();
          reject(new Error("仅支持 .xlsx、.xls、.csv 格式"));
          return;
        }

        fileName = filename;
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
          foundFile = true;
        });

        stream.on("limit", () => {
          stream.resume();
          reject(new Error("文件大小不能超过 50MB"));
        });
      });

      busboy.on("finish", () => {
        if (!foundSchemaId || !schemaId) {
          reject(new Error("请指定数据模型"));
          return;
        }
        if (!foundFile || !fileBuffer || !fileName) {
          reject(new Error("请选择文件"));
          return;
        }
        resolve({
          file: { name: fileName, buffer: fileBuffer },
          schemaId,
        });
      });

      busboy.on("error", (err: Error) => {
        reject(err);
      });

      // Pipe the request body through busboy
      const bodyReader = req.body?.getReader();
      if (!bodyReader) {
        reject(new Error("无法读取请求体"));
        return;
      }

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await bodyReader.read();
            if (done) {
              busboy.end();
              break;
            }
            busboy.write(Buffer.from(value));
          }
        } catch (err) {
          busboy.destroy();
          reject(err);
        }
      };
      pump();
    });

    // Verify schema ownership
    const schema = await prisma.schema.findFirst({
      where: { id: result.schemaId, userId: session.user.id },
    });
    if (!schema) {
      return NextResponse.json(
        { error: "数据模型不存在" },
        { status: 404 }
      );
    }

    // Save file to disk
    const uniqueName = `${Date.now()}-${result.file.name}`;
    const filePath = path.join(uploadDir, uniqueName);
    await writeFile(filePath, result.file.buffer);

    // Create import job record
    const importJob = await prisma.importJob.create({
      data: {
        schemaId: result.schemaId,
        fileName: result.file.name,
        filePath: `/uploads/${uniqueName}`,
        fileSize: result.file.buffer.length,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { importId: importJob.id, fileName: result.file.name, fileSize: result.file.buffer.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
