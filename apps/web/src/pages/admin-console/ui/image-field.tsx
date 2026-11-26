import { useState } from "react";
import { uploadImage } from "../../../features/control-shift/index.js";

export function ImageField({
  label,
  id,
  onChange,
  onBusy,
}: {
  label: string;
  id?: string;
  onChange: (id: string) => void;
  onBusy?: (value: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function choose(file: File) {
    setBusy(true);
    onBusy?.(true);
    setMessage("Загружаем…");
    const url = URL.createObjectURL(file);
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error("Выберите файл до 16 МБ.");
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL("image/webp", 0.78);
      if (!data.startsWith("data:image/webp;")) data = canvas.toDataURL("image/jpeg", 0.78);
      if (!/^data:image\/(?:jpeg|webp);/.test(data) || data.length > 320000)
        throw new Error("Попробуйте картинку меньшего размера.");
      const saved = await uploadImage(data.split(",")[1] ?? "");
      onChange(saved.id);
      setMessage("Картинка загружена");
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Не удалось загрузить картинку.");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <div className="space-y-2">
      <label className="grid gap-2 text-sm font-bold">
        {label}
        {id && (
          <img
            src={`/api/images/${id}`}
            alt="Предпросмотр"
            className="h-24 max-w-full rounded-lg object-contain"
          />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="studio-field py-2 text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void choose(file);
          }}
        />
      </label>
      <span role="status" className="text-xs text-mu">
        {message}
      </span>
    </div>
  );
}
