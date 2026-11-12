/**
 * IPI-1387 · Standard UI catalog decision for installed CopilotKit 1.85.0.
 * Source: https://docs.copilotkit.ai/generative-ui/components/standard-catalog
 * Inventory: standardUI.id = "copilotkit/standard@1" (69 components).
 *
 * First pilot: only our custom ConceptComparison is active. All 69 STANDARD
 * components are deliberately deferred, including read-only Blockquote
 * (unverified free-text risk) and Label (defer with forms/inputs).
 * No standardUI `extends` is registered; listing names here does not enable
 * any renderer, map/chart SDK, forms, functions, or business-data writes.
 * Future changes require a trusted data source, owner approval and a new
 * test/explicit classification before a standard component is enabled.
 */
export const STANDARD_CATALOG_VERSION = "copilotkit/standard@1";
export const DEFERRED_STANDARD_COMPONENTS = [
  "Box",
  "Column",
  "Row",
  "Grid",
  "GridItem",
  "Card",
  "Flow",
  "FlowItem",
  "Carousel",
  "CarouselItem",
  "CarouselMediaItem",
  "Spacer",
  "Divider",
  "Tabs",
  "Title",
  "Text",
  "Caption",
  "Label",
  "Bold",
  "Italic",
  "Underline",
  "Strikethrough",
  "Badge",
  "Blockquote",
  "Code",
  "Markdown",
  "Math",
  "ShimmerText",
  "Link",
  "Tooltip",
  "Button",
  "Pressable",
  "Form",
  "TextField",
  "TextArea",
  "Select",
  "CheckBox",
  "Radio",
  "RadioGroup",
  "Slider",
  "SegmentedControl",
  "ChoicePicker",
  "DateTimeInput",
  "PulseIndicator",
  "FlashcardFlip",
  "Popover",
  "PopoverTrigger",
  "PopoverContent",
  "Modal",
  "Table",
  "TableSection",
  "TableRow",
  "TableCell",
  "List",
  "ListItem",
  "Chart",
  "Map",
  "Image",
  "Icon",
  "Favicon",
  "Svg",
  "Video",
  "AudioPlayer",
  "HtmlView",
  "LinkCard",
  "Citation",
  "FollowUp",
  "EntityCard",
  "ImageGrid",
] as const;

export const PILOT_CUSTOM_COMPONENTS = ["ConceptComparison"] as const;
