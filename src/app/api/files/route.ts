import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getStorage, saveFileRecord, browseLocalDirectory, createLocalFolder, deleteLocalFolder } from "@/lib/storage";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "browse") {
    const dirPath = searchParams.get("path") || "";
    const entries = await browseLocalDirectory(dirPath);
    return NextResponse.json({ files: entries, currentPath: dirPath });
  }

  // Folders: list distinct folders
  if (action === "folders") {
    const folders = await prisma.storedFile.findMany({
      select: { folder: true },
      distinct: ["folder"],
      orderBy: { folder: "asc" },
    });
    const folderList = folders.map((f) => f.folder).filter(Boolean) as string[];
    // Also list from filesystem
    const entries = await browseLocalDirectory("");
    const dirs = entries.filter((e) => e.isDirectory).map((e) => `/${e.name}`);
    const allFolders = [...new Set([...dirs, ...folderList])].sort();
    return NextResponse.json({ folders: allFolders });
  }

  // List files from both StoredFile records and filesystem
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "100"), 200);
  const search = searchParams.get("search") || "";
  const folder = searchParams.get("folder") || "";

  // Get StoredFile records (filtered by userId for non-admin users)
  const isAdminUser = await import("@/lib/auth/permissions").then((m) => m.isAdmin(session.user.id));
  const sfWhere: Record<string, unknown> = {};
  if (search) sfWhere.originalName = { contains: search } as unknown as string;
  if (folder) sfWhere.folder = folder as unknown as string;
  if (!isAdminUser) {
    sfWhere.OR = [
      { userId: session.user.id },
      { sharedWith: { contains: session.user.id } },
    ] as unknown as Record<string, unknown>;
  }

  const storedFiles = await prisma.storedFile.findMany({
    where: sfWhere,
    orderBy: { createdAt: "desc" },
  });

  const storage = getStorage();
  const dbFiles = storedFiles.map((f) => ({
    id: f.id,
    originalName: f.originalName,
    storageType: f.storageType,
    storagePath: f.storagePath,
    fileSize: f.fileSize,
    mimeType: f.mimeType,
    bucket: f.bucket,
    tags: f.tags ? JSON.parse(f.tags) : [],
    folder: f.folder,
    userId: f.userId,
    createdAt: f.createdAt.toISOString(),
    url: storage.getUrl(f.storagePath),
  }));

  // List files from uploads directory (only for admins — no ownership tracking in fs)
  let fsFiles: Array<Record<string, unknown>> = [];
  if (isAdminUser) {
    const fsSubPath = folder.startsWith("/") ? folder.slice(1) : folder;
    const fsEntries = await browseLocalDirectory(fsSubPath);
    fsFiles = fsEntries
      .filter((f) => !f.isDirectory)
      .filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()))
      .map((f) => ({
        id: `fs_${f.path}`,
        originalName: f.name,
        storageType: "local",
        storagePath: f.path,
        fileSize: f.size,
        mimeType: null,
        bucket: null,
        tags: [] as string[],
        folder: folder || "/",
        userId: null,
        createdAt: f.modifiedAt.toISOString(),
        url: `/uploads/${f.path}`,
      }));
  }

  // Normalize paths and deduplicate by storagePath
  const normalize = (p: string) => p.replace(/\\/g, "/");
  const dbPaths = new Set(dbFiles.map((f) => normalize(f.storagePath)));
  const allFiles = [
    ...dbFiles,
    ...fsFiles.filter((f) => !dbPaths.has(normalize(f.storagePath as string))),
  ];
  allFiles.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const total = allFiles.length;
  const paged = allFiles.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ files: paged, total, page, pageSize });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  if (action === "delete-folder") {
    const name = searchParams.get("name");
    if (!name) return NextResponse.json({ error: "缺少文件夹名" }, { status: 400 });
    const ok = await deleteLocalFolder(name);
    if (!ok) return NextResponse.json({ error: "删除失败，文件夹不为空或不存在" }, { status: 400 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // Check if it's a folder creation action
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    if (body.action === "create-folder" && body.name) {
      const ok = await createLocalFolder(body.name);
      if (!ok) return NextResponse.json({ error: "创建文件夹失败" }, { status: 500 });
      return NextResponse.json({ success: true, name: body.name });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }

  // File upload
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }

  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "text/plain",
    "application/json",
  ];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv|json)$/i)) {
    return NextResponse.json({ error: "不支持的文件类型，仅支持 .xlsx/.xls/.csv/.json" }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "文件大小不能超过 50MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const storagePath = await storage.save(file.name, buffer, file.type, folder || undefined);

  const record = await saveFileRecord(
    file.name,
    storagePath,
    file.size,
    file.type || null,
    session.user.id,
    folder || undefined
  );

  return NextResponse.json({ ...record, tags: [], url: storage.getUrl(record.storagePath) }, { status: 201 });
}
