"use client";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  type Ref,
} from "react";
import Image from "next/image";
import CustomModal from "@/components/common/custom-modal";
import { useModal } from "@/components/provider/modal-provider";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { errorText } from "./workspace-data";
export type PhotoAttachmentApi = { addFiles: (files: File[]) => void };
export type PhotoMeta = {
  id: number;
  name: string;
  byteSize: number;
  width: number;
  height: number;
};
function Photo({
  photo,
  onRemove,
}: {
  photo: PhotoMeta;
  onRemove?: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const modalId = `workspace-photo-${photo.id}`,
    modal = useModal(modalId);
  useEffect(() => {
    if (!frame.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!visible) return;
    let disposed = false,
      objectUrl = "";
    apiFetchBlob(`/workspace/photos/${photo.id}?preview=true`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!disposed) setUrl(objectUrl);
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, visible]);
  return (
    <div
      className="work-photo"
      ref={frame}
      style={{ minHeight: 170 }}
    >
      {url ? (
        <a
          href="#photo"
          onClick={(e) => {
            e.preventDefault();
            modal.open();
          }}
          aria-label={`${photo.name} 크게 보기`}
        >
          <Image
            src={url}
            alt={photo.name}
            width={photo.width}
            height={photo.height}
            unoptimized
          />
        </a>
      ) : (
        <span role={error ? "alert" : undefined}>
          {error || "불러오는 중…"}
        </span>
      )}
      {modal.isOpen && (
        <CustomModal id={modalId}>
          <FullPhoto photo={photo} />
        </CustomModal>
      )}
      <div>
        <span>{photo.name}</span>
        {onRemove && (
          <button
            type="button"
            aria-label={`${photo.name} 제거`}
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
function FullPhoto({ photo }: { photo: PhotoMeta }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let disposed = false,
      objectUrl = "";
    apiFetchBlob(`/workspace/photos/${photo.id}`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!disposed) setUrl(objectUrl);
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id]);
  return (
    <section className="p-4 pt-12">
      <h2 className="mb-3 truncate text-sm font-semibold">{photo.name}</h2>
      {error ? (
        <p
          role="alert"
          className="text-sm"
        >
          {error}
        </p>
      ) : url ? (
        <>
          <div className="max-h-[60dvh] overflow-auto">
            <Image
              src={url}
              alt={photo.name}
              width={photo.width}
              height={photo.height}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-sky-700 dark:text-sky-300"
          >
            사진 크게 열기 ↗
          </a>
        </>
      ) : (
        <p className="py-8 text-sm">큰 사진을 불러오는 중…</p>
      )}
    </section>
  );
}
async function prepare(file: File): Promise<File> {
  if (file.size > 10 * 1024 * 1024)
    throw Error(`${file.name}: 사진 한 장은 10MB 이하여야 합니다.`);
  if (
    !/\.(jpe?g|png|gif)$/i.test(file.name) &&
    !["image/jpeg", "image/png", "image/gif"].includes(file.type)
  )
    throw Error(`${file.name}: JPG·PNG·GIF 사진을 선택해주세요.`);
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 80_000_000)
      throw Error(`${file.name}: 8천만 화소 이하 사진을 선택해주세요.`);
    if (
      Math.max(bitmap.width, bitmap.height) <= 2560 &&
      file.size <= 8 * 1024 * 1024
    )
      return file;
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("사진 처리에 실패했습니다.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("사진 변환에 실패했습니다."))),
        "image/jpeg",
        0.88,
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } finally {
    bitmap.close();
  }
}
export function PhotoAttachments({
  recordId,
  restoredIds,
  onChange,
  onBusy,
  attachmentApi,
}: {
  recordId?: number;
  restoredIds?: number[];
  attachmentApi?: Ref<PhotoAttachmentApi>;
  onChange: (ids: number[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]),
    [loaded, setLoaded] = useState(!recordId),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const initial = useQuery({
    queryKey: ["workspace-photos", recordId],
    queryFn: () =>
      apiFetch<PhotoMeta[]>(`/workspace/photos?recordId=${recordId}`),
    enabled: !!recordId && restoredIds === undefined,
  });
  useEffect(() => {
    if (initial.data && !loaded && restoredIds === undefined) {
      setPhotos(initial.data);
      setLoaded(true);
      onChange(initial.data.map((p) => p.id));
    }
  }, [initial.data, loaded, onChange, restoredIds]);
  useEffect(() => {
    if (restoredIds === undefined) return;
    let cancelled = false;
    setLoaded(false);
    Promise.allSettled(
      restoredIds.map((id) =>
        apiFetch<PhotoMeta>(`/workspace/photos/${id}/metadata`),
      ),
    ).then((results) => {
      if (cancelled) return;
      const available = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      setPhotos(available);
      onChange(available.map((p) => p.id));
      setLoaded(true);
      if (available.length !== restoredIds.length)
        setError(
          "보관 기간이 지났거나 접근할 수 없는 사진이 있습니다. 사진을 확인하고 다시 첨부해주세요.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [restoredIds, onChange]);
  useEffect(() => onBusy(busy || !loaded), [busy, loaded, onBusy]);
  useImperativeHandle(attachmentApi, () => ({
    addFiles: (files) => {
      void add(files);
    },
  }));
  async function add(files: File[]) {
    if (lock.current || !loaded || !files.length) return;
    setError("");
    if (photos.length + files.length > 40) {
      setError("기록당 최대 40장까지 첨부할 수 있습니다.");
      return;
    }
    if (
      photos.reduce((n, p) => n + p.byteSize, 0) +
        files.reduce((n, f) => n + f.size, 0) >
      200 * 1024 * 1024
    ) {
      setError("사진 합계는 기록당 200MB 이하여야 합니다.");
      return;
    }
    lock.current = true;
    setBusy(true);
    let next = [...photos];
    const errors: string[] = [];
    for (const file of files) {
      try {
        const converted = await prepare(file);
        const data = new FormData();
        data.append("file", converted);
        const photo = await apiFetch<PhotoMeta>("/workspace/photos", {
          method: "POST",
          body: data,
        });
        next = [...next, photo];
        setPhotos(next);
        onChange(next.map((p) => p.id));
      } catch (e) {
        errors.push(errorText(e));
      }
    }
    setError(errors.join("\n"));
    setBusy(false);
    lock.current = false;
    if (input.current) input.current.value = "";
  }
  function remove(id: number) {
    if (busy) return;
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    onChange(next.map((p) => p.id));
    if (!recordId)
      void apiFetch(`/workspace/photos/${id}`, { method: "DELETE" }).catch(
        () => {},
      );
  }
  return (
    <section className="work-photo-section">
      <h2>
        사진 첨부 <span>{photos.length}/40</span>
      </h2>
      <div
        className={`work-dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          void add(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) {
            e.preventDefault();
            e.stopPropagation();
            void add(files);
          }
        }}
        tabIndex={0}
        role="group"
        aria-label="사진 첨부 영역"
      >
        <button
          type="button"
          className="work-secondary"
          disabled={busy || !loaded}
          onClick={() => input.current?.click()}
        >
          ＋ 사진 선택 · 촬영
        </button>
        <p>
          {busy
            ? "사진 업로드 중…"
            : "사진을 여기에 끌어 놓거나 복사한 사진을 붙여넣으세요."}
        </p>
        <input
          type="file"
          ref={input}
          accept="image/jpeg,image/png,image/gif"
          multiple
          hidden
          onChange={(e) => void add(Array.from(e.target.files || []))}
        />
      </div>
      <p className="work-hint">
        JPG·PNG·GIF · 장당 최대 10MB · 최대 40장 · 기록당 합계 200MB
        <br />큰 사진은 화면 방향을 유지해 긴 변 2,560px로 자동 축소합니다.
        HEIC·WebP는 JPG로 변환 후 첨부해주세요.
      </p>
      {initial.error && (
        <p
          className="work-error"
          role="alert"
        >
          기존 사진을 불러오지 못했습니다.{" "}
          <button
            type="button"
            onClick={() => void initial.refetch()}
          >
            다시 시도
          </button>
        </p>
      )}
      {error && (
        <p
          className="work-error work-prewrap"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="work-photo-grid">
        {photos.map((p) => (
          <Photo
            key={p.id}
            photo={p}
            onRemove={() => remove(p.id)}
          />
        ))}
      </div>
    </section>
  );
}
export function PhotoGallery({ recordId }: { recordId: number }) {
  const query = useQuery({
    queryKey: ["workspace-photos", recordId],
    queryFn: () =>
      apiFetch<PhotoMeta[]>(`/workspace/photos?recordId=${recordId}`),
  });
  if (!query.error && !query.data?.length) return null;
  return (
    <section>
      <h2>사진</h2>
      {query.error ? (
        <p
          className="work-error"
          role="alert"
        >
          {errorText(query.error)}
        </p>
      ) : (
        <div className="work-photo-grid">
          {query.data?.map((p) => (
            <Photo
              key={p.id}
              photo={p}
            />
          ))}
        </div>
      )}
    </section>
  );
}
