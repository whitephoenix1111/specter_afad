// ============================================================
// firebase.ts — Khởi tạo Firebase Admin SDK và Cloudinary.
// Import file này ở bất kỳ đâu cần dùng db hoặc uploadToCloudinary.
//
// Firebase Admin dùng serviceAccountKey.json để xác thực.
// Cloudinary dùng credentials từ .env để upload ảnh AI.
// ============================================================

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";
import { createRequire } from "module";

// Dùng createRequire để import JSON với "type": "module" (ESM)
const require = createRequire(import.meta.url);
const serviceAccount = require("../serviceAccountKey.json") as ServiceAccount;

// Khởi tạo Firebase Admin — chỉ chạy 1 lần khi module được load
initializeApp({
  credential: cert(serviceAccount),
});

// Firestore instance — dùng để đọc/ghi data articles
export const db = getFirestore();

// Cloudinary config — dùng credentials từ .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  api_key:    process.env.CLOUDINARY_API_KEY    ?? "",
  api_secret: process.env.CLOUDINARY_API_SECRET ?? "",
});

// Upload buffer ảnh lên Cloudinary, trả về URL công khai.
//
// publicId: tên file trên Cloudinary, VD: "afad/VIC_0"
//   → Nếu upload lại cùng publicId → ghi đè ảnh cũ (không tích lũy)
//   → Folder "afad" tự tạo nếu chưa có
//
// Trả về secure_url dạng https://res.cloudinary.com/...
export async function uploadToCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          public_id: publicId,
          folder: "afad",           // Tất cả ảnh vào folder afad/
          overwrite: true,          // Ghi đè nếu cùng publicId → không tích lũy file thừa
          resource_type: "image",
          format: "jpg",
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
          resolve(result.secure_url);
        }
      )
      .end(buffer);
  });
}
