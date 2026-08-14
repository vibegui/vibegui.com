import { evaluate } from "@mdx-js/mdx";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import {
  BridgeHub,
  BridgeLoop,
  FactoryGap,
  FactoryPlant,
  FactoryTimeline,
  StoryCast,
  StoryCompound,
  StoryDecay,
  StoryRooms,
} from "./story-bridge.tsx";

const mdxComponents = {
  BridgeHub,
  BridgeLoop,
  FactoryGap,
  FactoryPlant,
  FactoryTimeline,
  StoryCast,
  StoryCompound,
  StoryDecay,
  StoryRooms,
};

/**
 * MDX is authored in this repository and compiled during the content build.
 * Rendering it to HTML keeps article delivery identical to Markdown articles:
 * the browser receives inert, trusted markup rather than executable MDX.
 */
export async function renderMdx(source: string): Promise<string> {
  const module = await evaluate(source, {
    ...runtime,
    development: false,
    useMDXComponents: () => mdxComponents,
  });

  return renderToStaticMarkup(
    createElement(module.default, {
      components: mdxComponents,
    } as ComponentProps<typeof module.default>),
  );
}
