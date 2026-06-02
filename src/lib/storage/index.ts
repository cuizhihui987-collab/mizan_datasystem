import { writeFile, mkdir, readdir, stat, unlink, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: Date;
}

export interface StoredFileRecord {
  id: string;
  originalName: string;
  storageType: string;
  storagePath: string;
  fileSize: number;
  mimeType: string | null;
  bucket: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageService {
  save(fileName: string, data: Buffer, mimeType?: string, folder?: string): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  getUrl(storagePath: string): string;
  exists(storagePath: string): Promise<boolean>;
}

// ─── Local Storage ─────────────────────────────────────

class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), "public", "uploads");
  }

  private fullPath(storagePath: string): string {
    return path.join(this.baseDir, storagePath);
  }

  async save(fileName: string, data: Buffer, _mimeType?: string, folder?: string): Promise<string> {
    const subDir = folder && folder !== "/" ? folder.replace(/^\//, "").replace(/\\/g, "/") : "";
    const targetDir = subDir ? path.join(this.baseDir, subDir) : this.baseDir;
    await mkdir(targetDir, { recursive: true });
    const timestamp = Date.now();
    const safeName = subDir
      ? `${subDir}/${timestamp}-${fileName.replace(/[<>:"/\\|?*]/g, "_")}`
      : `${timestamp}-${fileName.replace(/[<>:"/\\|?*]/g, "_")}`;
    await writeFile(this.fullPath(safeName), data);
    return safeName;
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(this.fullPath(storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    await unlink(this.fullPath(storagePath)).catch(() => {});
  }

  getUrl(storagePath: string): string {
    return `/uploads/${storagePath}`;
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await stat(this.fullPath(storagePath));
      return true;
    } catch {
      return false;
    }
  }

  async listDirectory(subPath: string): Promise<FileInfo[]> {
    const dirPath = path.join(this.baseDir, subPath);
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const files: FileInfo[] = [];
      for (const entry of entries) {
        const fullEntryPath = path.join(dirPath, entry.name);
        const stats = await stat(fullEntryPath);
        files.push({
          name: entry.name,
          path: path.join(subPath, entry.name).replace(/\\/g, "/"),
          size: stats.size,
          isDirectory: entry.isDirectory(),
          modifiedAt: stats.mtime,
        });
      }
      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  }
}

// ─── S3 Storage ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _S3Client: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _PutObjectCommand: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _GetObjectCommand: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _DeleteObjectCommand: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _HeadObjectCommand: any;

async function ensureS3Imports() {
  if (!_S3Client) {
    const s3 = await import("@aws-sdk/client-s3");
    _S3Client = s3.S3Client;
    _PutObjectCommand = s3.PutObjectCommand;
    _GetObjectCommand = s3.GetObjectCommand;
    _DeleteObjectCommand = s3.DeleteObjectCommand;
    _HeadObjectCommand = s3.HeadObjectCommand;
  }
}

class S3StorageService implements StorageService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client: any = null;
  private bucket: string;
  private endpoint: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || "mizan-files";
    this.endpoint = process.env.S3_ENDPOINT || "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this.s3Client) {
      await ensureS3Imports();
      this.s3Client = new _S3Client({
        endpoint: this.endpoint || undefined,
        region: process.env.S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || "",
          secretAccessKey: process.env.S3_SECRET_KEY || "",
        },
        forcePathStyle: !!this.endpoint,
      });
    }
    return this.s3Client;
  }

  async save(fileName: string, data: Buffer, mimeType?: string, folder?: string): Promise<string> {
    const client = await this.getClient();
    const timestamp = Date.now();
    const subPath = folder && folder !== "/" ? `${folder.replace(/^\//, "")}/` : "";
    const key = `${subPath}${timestamp}-${fileName.replace(/[<>:"/\\|?*]/g, "_")}`;
    await client.send(
      new _PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType || "application/octet-stream",
      })
    );
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const client = await this.getClient();
    const response = await client.send(
      new _GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    await client.send(
      new _DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    ).catch(() => {});
  }

  getUrl(key: string): string {
    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      await client.send(
        new _HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Factory ────────────────────────────────────────────

let storageInstance: StorageService | null = null;

export function getStorage(): StorageService {
  if (storageInstance) return storageInstance;

  const type = process.env.STORAGE_TYPE || "local";
  if (type === "s3") {
    storageInstance = new S3StorageService();
  } else {
    storageInstance = new LocalStorageService();
  }
  return storageInstance;
}

// ─── Database helpers ───────────────────────────────────

export async function saveFileRecord(
  originalName: string,
  storagePath: string,
  fileSize: number,
  mimeType: string | null,
  userId?: string,
  folder?: string
): Promise<StoredFileRecord> {
  const storageType = process.env.STORAGE_TYPE || "local";
  const record = await prisma.storedFile.create({
    data: {
      originalName,
      storageType,
      storagePath,
      fileSize,
      mimeType,
      folder: folder || "/",
      bucket: storageType === "s3" ? (process.env.S3_BUCKET || "mizan-files") : null,
      userId: userId || null,
    },
  });
  return record;
}

export async function deleteFileRecord(id: string): Promise<void> {
  const record = await prisma.storedFile.findUnique({ where: { id } });
  if (!record) return;

  const storage = getStorage();
  await storage.delete(record.storagePath);
  await prisma.storedFile.delete({ where: { id } });
}

export async function browseLocalDirectory(subPath: string): Promise<FileInfo[]> {
  const storage = getStorage();
  if (storage instanceof LocalStorageService) {
    return storage.listDirectory(subPath);
  }
  return [];
}

function getUploadDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export async function createLocalFolder(subPath: string): Promise<boolean> {
  try {
    await mkdir(path.join(getUploadDir(), subPath), { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export async function deleteLocalFolder(subPath: string): Promise<boolean> {
  try {
    const { rmdir } = await import("fs/promises");
    await rmdir(path.join(getUploadDir(), subPath), { recursive: false });
    return true;
  } catch {
    return false;
  }
}
