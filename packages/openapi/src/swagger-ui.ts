// @nexus/openapi - Swagger UI integration

export interface SwaggerUIOptions {
  title?: string;
  specUrl?: string;
  customCss?: string;
  deepLinking?: boolean;
  displayOperationId?: boolean;
  filter?: boolean;
}

/**
 * Generate Swagger UI HTML page
 */
export function getSwaggerUIHtml(options: SwaggerUIOptions = {}): string {
  const {
    title = "API Documentation",
    specUrl = "/openapi.json",
    customCss = "",
    deepLinking = true,
    displayOperationId = false,
    filter = true,
  } = options;

  const configJson = JSON.stringify({
    url: specUrl,
    deepLinking,
    displayOperationId,
    filter,
    layout: "StandaloneLayout",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    ${customCss}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle(Object.assign(${configJson}, {
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
      }));
    };
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
