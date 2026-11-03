"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import PhotoSkeleton from "./photo-skeleton";

export default function LoadingPhoto(props: ImageProps) {
  const [loadedSource, setLoadedSource] = useState<ImageProps["src"] | null>(null);
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const loaded = loadedSource === props.src;
  const failed = failedSource === props.src;
  return <span className={`loading-photo${props.fill ? " loading-photo-fill" : ""}`} data-ready={loaded}>
    {!loaded && !failed && <PhotoSkeleton />}
    {failed && <span role="alert" className="photo-load-error">사진을 불러오지 못했습니다.</span>}
    <Image {...props} alt={props.alt} style={{ ...props.style, opacity: loaded ? 1 : 0 }} onLoad={event => { setLoadedSource(props.src); props.onLoad?.(event); }} onError={event => { setFailedSource(props.src); props.onError?.(event); }} />
  </span>;
}
