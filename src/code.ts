type PluginMessage =
  | { type: "ready" }
  | { type: "refresh-selection" }
  | { type: "copy-generated-url"; url: string }
  | { type: "notify"; message: string };

type UiSelectionMessage = {
  type: "selection";
  payload: {
    text: string;
    nodeCount: number;
    truncated: boolean;
  };
};

type NodeType = "TEXT" | "GROUP" | "FRAME" | "COMPONENT" | "INSTANCE" | "SECTION" | string;

interface BaseNode {
  readonly type: NodeType;
  readonly name: string;
}

interface TextLikeNode extends BaseNode {
  readonly type: "TEXT";
  readonly characters: string;
}

interface ChildrenNode extends BaseNode {
  readonly children: ReadonlyArray<SceneNodeLike>;
}

type SceneNodeLike = BaseNode | TextLikeNode | ChildrenNode;

interface CurrentPageLike {
  readonly selection: ReadonlyArray<SceneNodeLike>;
}

interface UiApiLike {
  onmessage: ((message: PluginMessage) => void) | undefined;
  postMessage(message: UiSelectionMessage): void;
}

interface PluginApiLike {
  readonly currentPage: CurrentPageLike;
  readonly ui: UiApiLike;
  showUI(html: string, options: { width: number; height: number; themeColors: boolean }): void;
  notify(message: string, options?: { timeout?: number; error?: boolean }): void;
  on(event: "selectionchange", callback: () => void): void;
}

declare const figma: PluginApiLike;
declare const __html__: string;

const MAX_SELECTION_CHARACTERS = 6000;

figma.showUI(__html__, {
  width: 440,
  height: 660,
  themeColors: true
});

figma.ui.onmessage = (message: PluginMessage) => {
  if (message.type === "ready" || message.type === "refresh-selection") {
    postSelection();
    return;
  }

  if (message.type === "copy-generated-url") {
    figma.notify("Generated UTM URL copied from the plugin UI.", { timeout: 1600 });
    return;
  }

  if (message.type === "notify") {
    figma.notify(message.message, { timeout: 1800 });
  }
};

figma.on("selectionchange", postSelection);

function postSelection(): void {
  const textLayers: string[] = [];

  for (const node of figma.currentPage.selection) {
    collectText(node, textLayers);
  }

  const fullText = textLayers.join("\n").trim();
  const truncated = fullText.length > MAX_SELECTION_CHARACTERS;
  const text = truncated ? fullText.slice(0, MAX_SELECTION_CHARACTERS) : fullText;

  figma.ui.postMessage({
    type: "selection",
    payload: {
      text,
      nodeCount: textLayers.length,
      truncated
    }
  });
}

function collectText(node: SceneNodeLike, output: string[]): void {
  if (isTextNode(node)) {
    const value = node.characters.trim();
    if (value) output.push(value);
    return;
  }

  if (hasChildren(node)) {
    for (const child of node.children) {
      collectText(child, output);
    }
  }
}

function isTextNode(node: SceneNodeLike): node is TextLikeNode {
  return node.type === "TEXT" && "characters" in node;
}

function hasChildren(node: SceneNodeLike): node is ChildrenNode {
  return "children" in node && Array.isArray(node.children);
}

