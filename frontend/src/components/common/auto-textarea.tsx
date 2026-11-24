"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ComponentProps } from "react";

const textSizingProperties = [
  "font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variant",
  "font-feature-settings", "font-variation-settings", "line-height", "letter-spacing",
  "word-spacing", "text-transform", "text-indent", "text-align", "text-rendering",
  "direction", "tab-size", "white-space", "overflow-wrap", "word-break",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
];

function resizeTextarea(element: HTMLTextAreaElement, measure: HTMLDivElement) {
  const width = element.clientWidth;
  if (!width) return;

  // Measure separately so resizing never collapses the focused editor or its scroll container.
  const styles = getComputedStyle(element);
  measure.style.width = `${width}px`;
  for (const property of textSizingProperties) {
    measure.style.setProperty(property, styles.getPropertyValue(property));
  }
  // Keep an empty field or a trailing blank line measurable.
  const text = element.value || element.placeholder;
  measure.textContent = !text || text.endsWith("\n") ? `${text}\u200b` : text;

  const adjustment = styles.boxSizing === "border-box"
    ? parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth)
    : -(parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom));
  const height = `${measure.scrollHeight + adjustment}px`;
  if (element.style.height !== height) element.style.height = height;
}

const AutoTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  function AutoTextarea({ onInput, style, ...props }, ref) {
    const node = useRef<HTMLTextAreaElement>(null);
    const measurement = useRef<HTMLDivElement | null>(null);
    const resizeOnNextFrame = useRef<(() => void) | null>(null);
    useImperativeHandle(ref, () => node.current!);

    useLayoutEffect(() => {
      const element = node.current;
      if (!element) return;
      const measure = document.createElement("div");
      measure.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;box-sizing:border-box;height:0;min-height:0;max-height:none;border:0;overflow:hidden;";
      measure.setAttribute("aria-hidden", "true");
      document.body.append(measure);
      measurement.current = measure;

      let width = element.clientWidth;
      let frame = 0;
      const scheduleResize = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => resizeTextarea(element, measure));
      };
      resizeOnNextFrame.current = scheduleResize;
      const observer = new ResizeObserver(() => {
        const nextWidth = element.clientWidth;
        if (nextWidth === width) return;
        width = nextWidth;
        scheduleResize();
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        measure.remove();
        measurement.current = null;
        resizeOnNextFrame.current = null;
      };
    }, []);

    useLayoutEffect(() => {
      if (node.current && measurement.current) resizeTextarea(node.current, measurement.current);
    }, [props.value, props.defaultValue, props.placeholder, props.wrap, props.className, style]);

    return <textarea
      {...props}
      ref={node}
      style={{ ...style, overflowY: "hidden", resize: "none", maxHeight: "none" }}
      onInput={event => {
        if (props.value == null) resizeOnNextFrame.current?.();
        onInput?.(event);
      }}
    />;
  },
);

export default AutoTextarea;
