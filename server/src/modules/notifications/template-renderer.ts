function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getPathValue(input: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = input;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function replaceTemplate(template: string, variables: Record<string, unknown>, htmlSafe: boolean): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, rawPath: string) => {
    const value = getPathValue(variables, rawPath.trim());
    if (value === null || value === undefined) {
      return "";
    }

    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    return htmlSafe ? escapeHtml(stringValue) : stringValue;
  });
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate(input: {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: Record<string, unknown>;
}): RenderedTemplate {
  return {
    subject: replaceTemplate(input.subjectTemplate, input.variables, false),
    html: replaceTemplate(input.htmlTemplate, input.variables, true),
    text: replaceTemplate(input.textTemplate, input.variables, false),
  };
}
