"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import PhotoSkeleton from "./photo-skeleton";

export default function AboutImage({ mobileSrc, ...props }: ImageProps & { mobileSrc?: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = <Image {...props} alt={props.alt} style={{ ...props.style, opacity: ready ? 1 : 0 }} onLoad={() => setReady(true)} onError={() => setFailed(true)} />;
  return <span className={`about-image${mobileSrc ? " about-image-responsive" : ""}`}>
    {!ready && !failed && <PhotoSkeleton large />}
    {failed && <span role="alert" className="photo-load-error">사진을 불러오지 못했습니다.</span>}
    {mobileSrc ? <picture><source media="(max-width: 767px)" srcSet={mobileSrc} width={390} height={844} />{image}</picture> : image}
  </span>;
}
