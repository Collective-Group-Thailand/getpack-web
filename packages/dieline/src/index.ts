/**
 * `@packio/dieline` — Packio's box geometry engine. Framework-free: runs in the browser and in
 * Node. See README.md for the public API and docs/design-tool/ for the architecture.
 */
export type {
  Annotation,
  ArcEdge,
  BezierEdge,
  BoxCategory,
  BoxStyleDef,
  Bounds,
  Contour,
  Dieline,
  Edge,
  EdgeRole,
  Face,
  FaceKind,
  HingeMap,
  Issue,
  LineEdge,
  Localized,
  MaterialSpec,
  ParamGroup,
  ParamKind,
  ParamOption,
  ParamSchema,
  ParamValue,
  ParamValues,
  Piece,
  PiecePlacement,
  Pt,
  StylePreset,
} from "./types";
export { EDGE_ROLES } from "./types";

export {
  arc,
  arcAngles,
  bezier,
  boundsOf,
  edgeLength,
  edgesBounds,
  ellipse,
  flattenContour,
  flattenEdge,
  flattenOpen,
  FLATTEN_TOLERANCE_MM,
  line,
  polygon,
  rectangle,
  reverseContour,
  roundedRectangle,
  signedArea,
  svgPathData,
} from "./path";
export { allFaces, assemble, face, faceBounds, findFace, piece, PIECE_GAP_MM } from "./faces";
export { dielineLines, edgeKey, type DielineLine } from "./lines";
export { polygonInsideWithMargin, pointInPolygon } from "./geom";
export {
  bleedOutline,
  facePolygons,
  offsetFace,
  overlapArea,
  pieceOutline,
  polygonsArea,
  safeZone,
  triangulate,
} from "./offset";
export { checkDieline, CLOSURE_TOLERANCE_MM, type GeometryProblem } from "./checks";
export {
  applyMat4,
  foldDieline,
  foldedBounds,
  foldPiece,
  hingesOf,
  lift,
  type Box3,
  type Hinge,
  type Mat4,
  type Vec3,
} from "./fold";
export { FACE_LABELS, PIECE_LABELS, faceLabel, pieceLabel, type FaceLabel, type PieceLabel } from "./labels";
export { isActive, schemaIssues, withDefaults } from "./params";
export * as constants from "./constants";
export { DEFAULT_BLEED_MM, DEFAULT_SAFE_MM } from "./constants";
export { dielineToSvg, type SvgOptions } from "./export/svg";
export { dielineToDxf } from "./export/dxf";
export { dielineToPdf, type PdfImage, type PdfOptions } from "./export/pdf";
export { LAYER_OF, LAYER_ORDER, LAYER_STYLE, type LayerName } from "./export/layers";
export { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "./materials";
export {
  buildStyle,
  getStyle,
  hingeMapOf,
  isStyleId,
  resolveStyleId,
  resolveValues,
  STYLE_ALIASES,
  STYLES,
  stylesByCategory,
  validateStyle,
} from "./styles";
export {
  buildFromRecipe,
  collectExpressions,
  PARAM_LIBRARY,
  parseRecipe,
  RECIPES,
  RecipeError,
  recipeConstraints,
  resolveParam,
  styleFromRecipe,
  type BuiltRecipe,
  type RecipeModule,
  type RecipeParam,
  type StyleRecipe,
  defaultsOf,
  presetsOf,
  AXIS_PHRASES,
  describeVariant,
  variantKey,
  variantsOf,
  outerSizeOf,
  type StyleVariant,
  type VariantWords,
} from "./recipes";
export {
  getModule,
  MODULES,
  PROCESSES,
  type BodyKind,
  type Constraint,
  type ModuleConfig,
  type ModuleDef,
  type ModuleSlot,
  type Process,
} from "./modules";
export {
  explain,
  isBuildable,
  RESOLUTION_MM,
  sizeRanges,
  validRanges,
  type ParamRange,
  type Violation,
  type ViolationRule,
} from "./solver";
export {
  MATERIAL_CLASSES,
  materialClassOf,
  materialRules,
  type MaterialClass,
  type MaterialRules,
} from "./rules/materials";
export { dielineManufacturing } from "./rules/manufacturing";
export {
  fitsEnvelope,
  recipeProcesses,
  type EnvelopeFit,
  type EnvelopeReason,
  type MachineEnvelope,
} from "./rules/envelope";
export { foldModel, modelBounds, slabPoint, WRAP_MM, type FoldedModel, type ModelFace } from "./model/thickness";
export { collisions, CONTACT_MM } from "./model/collide";
export { inflatedPouch, pouchBulge, type SurfaceMesh } from "./model/pouch";
export { Raster, type Image, type Rgb } from "./render/raster";
export {
  AMBIENT,
  render2D,
  render3D,
  renderSurface,
  STUDIO_LIGHTS,
  TONES,
  VIEW,
  type BoardTone,
  type ThumbnailOptions,
} from "./render/thumbnails";
export { callsOf, compile as compileExpression, ExprError, namesOf, type ExprValue } from "./expr";
export { fixtureFileKey, patternFixtures, type PatternFixture } from "./fixtures";
export { parseSvgPath } from "./svgpath";
export {
  isDielineSpec,
  isV1Spec,
  LEGACY_BOARDS,
  migrateSpec,
  remapV1Point,
  SPEC_VERSION,
  v1FaceId,
  type DielineSpec,
  type V1Spec,
} from "./migrate";

/** CSS pixels per millimetre at 96 dpi, for canvases that draw at true size. */
export const PX_PER_MM = 96 / 25.4;
