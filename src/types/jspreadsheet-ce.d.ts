declare module "jspreadsheet-ce" {
  const jspreadsheet: (element: HTMLElement, options: Record<string, unknown>) => { destroy?: () => void } | Array<{ destroy?: () => void }>;
  export default jspreadsheet;
}
