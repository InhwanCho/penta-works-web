"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ComponentProps } from "react";

const AutoTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  function AutoTextarea({ onInput, style, ...props }, ref) {
    const node = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => node.current!);
    useLayoutEffect(() => {
      const element = node.current;
      if (!element) return;
      let width = -1;
      const resize = () => {
        if (!element.clientWidth) return;
        element.style.height = "0px";
        const border = element.offsetHeight - element.clientHeight;
        element.style.height = element.scrollHeight + border + "px";
      };
      resize();
      const observer = new ResizeObserver(() => {
        if (element.clientWidth !== width) { width = element.clientWidth; resize(); }
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [props.value, props.defaultValue]);
    return <textarea {...props} ref={node} style={{ ...style, overflowY: "hidden", resize: "none", maxHeight: "none" }} onInput={event => {
      const element = event.currentTarget;
      element.style.height = "0px";
      element.style.height = element.scrollHeight + element.offsetHeight - element.clientHeight + "px";
      onInput?.(event);
    }} />;
  },
);
export default AutoTextarea;
