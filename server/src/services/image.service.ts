// ============================================================
// services/image.service.ts
// Chịu trách nhiệm gọi HuggingFace Inference API để sinh ảnh
// từ một đoạn text prompt (tiếng Anh), sau đó trả về chuỗi
// base64 Data URL để client hiển thị trực tiếp qua <img src>.
// ============================================================

export class ImageService {
  // URL endpoint của model FLUX.1-schnell trên HuggingFace router.
  // Model này nhận text prompt → trả về binary image.
  private readonly apiUrl =
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

  // API Key lấy từ biến môi trường .env
  // Nếu chưa set thì mặc định là chuỗi rỗng (sẽ gây lỗi 401 khi gọi API)
  private readonly apiKey = process.env.HUGGINGFACE_API_KEY ?? "";

  /**
   * Gọi HuggingFace để sinh ảnh từ prompt văn bản.
   * @param imagePrompt - Mô tả cảnh ảnh bằng tiếng Anh
   * @returns Chuỗi Data URL dạng "data:image/jpeg;base64,..."
   */
  async generateImageUrl(imagePrompt: string): Promise<string> {

    // Bước 1: Gửi POST request tới HuggingFace với prompt
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,  // Xác thực bằng API Key
        "Content-Type": "application/json",
        "x-wait-for-model": "true",               // Nếu model đang warm-up thì chờ thay vì báo lỗi ngay
      },
      body: JSON.stringify({ inputs: imagePrompt }), // Truyền prompt vào field "inputs"
    });

    // Bước 2: Kiểm tra HTTP status, nếu không phải 2xx thì ném lỗi
    if (!response.ok) {
      const errText = await response.text(); // Đọc body lỗi để debug
      throw new Error(`HuggingFace image error: ${response.status} — ${errText}`);
    }

    // Bước 3: Đọc toàn bộ body dưới dạng binary (ArrayBuffer)
    // vì HuggingFace trả về raw bytes của file ảnh, không phải JSON
    const buffer = await response.arrayBuffer();

    // Bước 4: Chuyển binary → chuỗi Base64
    const base64 = Buffer.from(buffer).toString("base64");

    // Bước 5: Ghép thành Data URL chuẩn mà <img src="..."> có thể đọc trực tiếp
    return `data:image/jpeg;base64,${base64}`;
  }
}
