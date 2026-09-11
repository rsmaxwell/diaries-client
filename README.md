# diaries-client

`diaries-client` is the Angular/TypeScript browser client for the Diaries application.

It provides the user interface for viewing and editing diaries, pages, fragments, marquees, and associated images. It communicates with the Java responder through MQTT RPC and subscribes to retained MQTT topic-tree objects to keep the UI synchronised with server state.

This project is one part of the wider Diaries system:

```text id="1gl0ra"
diaries/
  diaries-client/       Angular browser client
  diaries-responder/    Java MQTT responder/server
```

For the system-wide design, see the top-level `ARCHITECTURE.md` in the parent `diaries` repository.

## Responsibilities

The client is responsible for:

* presenting the Diaries user interface
* signing in and maintaining access/refresh token state
* sending MQTT RPC requests to the responder
* subscribing to retained live objects from the MQTT broker
* displaying diaries, pages, fragments, marquees, and images
* maintaining local selection and editing state
* handling user interactions such as selecting, moving, resizing, editing, locking, unlocking, creating, and deleting objects

The client should normally treat the retained MQTT topic tree as the live model of the application. RPC replies confirm whether a command succeeded, but the displayed long-term state should come from subscribed live objects.

## Technology

The client uses:

* Angular
* TypeScript
* Angular Material
* RxJS
* MQTT.js
* Golden Layout
* Quill / ngx-quill
* UUID support
* SCSS styling

## Prerequisites

Install:

* Node.js
* npm
* Angular CLI, either globally or through `npx`

A typical setup is:

```bash id="tmzwf2"
npm install
```

If Angular CLI is not installed globally, use:

```bash id="kszavv"
npx ng version
```

## Development server

Start the local development server with:

```bash id="mfjf0k"
npm start
```

This runs:

```bash id="dctfhd"
ng serve
```

Then open:

```text id="l8fowr"
http://localhost:4200/
```

The application reloads automatically when source files change.

## Build

Build the application with:

```bash id="d6a7cb"
npm run build
```

The build output is written to:

```text id="1bz4pi"
dist/diaries-client
```

The default build configuration is currently the development configuration.

For a production build, use:

```bash id="6os7o6"
ng build --configuration production
```

## Watch build

For a rebuild-on-change workflow without serving the application directly:

```bash id="55fb54"
npm run watch
```

This runs an Angular build in watch mode using the development configuration.

## Tests

Run the unit tests with:

```bash id="aqgb10"
npm test
```

This uses Angular/Karma test support.

## Configuration

Client configuration is held in the Angular environment files:

```text id="a2f1jx"
src/environments/environment.ts
src/environments/environment.development.ts
```

Important settings include:

| Setting                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `production`           | Whether this is a production build                    |
| `title`                | Application title shown by the client                 |
| `mqttDebug`            | Enables extra MQTT/client diagnostic logging          |
| `brokerPath`           | MQTT broker websocket path, for example `/mosquitto/` |
| `brokerOriginOverride` | Optional broker origin override                       |

The development environment enables MQTT debug logging. The production environment disables it.

## MQTT model

The client communicates with the responder over MQTT.

There are two related patterns:

### MQTT RPC

The client sends commands to the responder, such as sign-in, create, update, delete, lock, and unlock operations.

A typical request includes:

* operation name
* arguments
* response topic
* correlation data
* user properties such as the access token

The responder replies to the requested response topic.

### Retained live objects

The responder publishes application state as retained MQTT messages.

The client subscribes to these retained objects and updates the UI reactively. This means the client does not need to infer all state changes from RPC replies alone.

The preferred model is:

```text id="ypu9uj"
User action
  -> MQTT RPC request
  -> responder validates and updates database
  -> responder publishes retained object state
  -> client receives topic update
  -> UI updates from live object stream
```

## Authentication

The client signs in through the responder and receives access and refresh tokens.

The access token is used on subsequent MQTT RPC requests. The refresh token is used to obtain new access tokens.

The responder remains responsible for validating tokens and authorising operations.

## Static files and images

Large image data is not carried directly in MQTT messages.

Images and uploaded files are served by the static file server. The client displays them using URLs or metadata supplied by the responder/live object state.

As a temporary migration compatibility measure, day-reader fragment HTML can
resolve the old importer form `images/<filename>` beneath the selected diary's
files directory. Only a single image filename with a supported image extension
is accepted; nested paths, traversal, query strings and fragments are rejected.
Absolute URLs and other non-legacy values are left unchanged. New data should
use explicit IMAGE-fragment metadata instead of relying on this resolver.

## Development notes

When debugging client/server behaviour, consider all of the following together:

* browser console log
* MQTT RPC request and reply messages
* retained topic-tree state
* responder log
* PostgreSQL state
* static file server URLs

Many bugs involve both the Angular client and the Java responder. For example, a UI issue may be caused by a retained topic not being updated, an RPC reply shape changing, a lock/unlock race, or stale selected object state.

## Reader-style design foundation

The client shares the reader-oriented visual language established by `diaries-web`, but does not load styles or assets from that application at runtime. The central source of truth is `src/styles/_tokens.scss`. It defines the warm reader palette and typography roles, and emits matching `--diaries-*` CSS custom properties for component and CDK overlay use.

The semantic palette is:

| Token | Value | Purpose |
| --- | --- | --- |
| `ink` | `#28241f` | Primary text |
| `muted` | `#655e54` | Metadata and supporting text |
| `paper` | `#fbf8f1` | Application page background |
| `surface` | `#fffdf8` | Controls, dialogs and raised reading surfaces |
| `line` | `#d9cfbd` | Borders and separators |
| `accent` | `#765326` | Primary actions and emphasis |
| `accent-dark` | `#4d3417` | Links and high-contrast accent text |
| `focus` | `#165d9c` | Keyboard focus indicator |

Reader content and prominent reader headings use the Georgia/Times-style serif roles. Controls and metadata use the system UI sans-serif roles, while request and build identifiers can use the monospace role. Angular Material is configured in `src/app/theme.scss` to use the UI typography and the same semantic colours, including dialogs and other CDK overlay content.

New component styles should consume the semantic Sass variables from `src/styles/_tokens.scss` (directly or through the compatibility `constants.scss` entry point), or the generated `--diaries-*` custom properties. Do not create a separate copy of the palette in component styles.

Shared application headers and footers use `src/styles/_shell.scss` for their toolbar, inner-width, title and icon-control patterns. These shell components use warm surfaces, thin separators and serif titles without Material elevation. Their actions remain system-sans and wrap at the shared 44rem narrow-layout breakpoint. Alerts, build metadata and file dialogs consume the same semantic tokens; dialog sizing that must reach the CDK overlay container is defined in the global stylesheet.

Diary and page browsing use semantic ordered lists rather than Material data tables. Their common layout and drag-state rules live in `src/styles/_reader-navigation.scss`: names are the primary serif content, IDs and sequence positions are muted metadata, and navigation buttons are separate from labelled CDK drag handles so selecting and reordering remain unambiguous.

The day view follows the same document-oriented approach inside the fragment workspace. It renders the date as a reader heading and Quill transcription fragments as a semantic ordered passage list in a constrained reading column. Fragment articles remain navigation targets, while separate labelled drag handles preserve the lock-protected resequencing flow. The selected source-page marquee and selected passage stay synchronised in both directions; selecting a passage navigates to its owning page and marquee, while selecting a marquee highlights and scrolls its passage into view. Marquee-less fragments remain selectable in the passage list without inventing a source-page location. Dynamically inserted Quill content must retain the day-view containment rules for long strings, preformatted text and embedded images.

The fragment editor keeps its Golden Layout image/transcription split while presenting it as a working reader surface. Decorative image backing belongs on the outer `.viewer-frame` so the SVG remains the coordinate-bearing element for pan, zoom and marquee interaction. Only the selected marquee is rendered, with a focus-colour outline. The transcription pane uses reader typography for Quill content and system UI typography for its toolbar, metadata, lock state and save controls; read-only and save-in-progress states are announced in the panel as well as reflected by disabled controls.

### Responsive and accessibility conventions

Responsive decisions are based on content rather than named devices:

| Breakpoint | Behaviour |
| --- | --- |
| `44rem` | Reader shells tighten, application actions wrap, authentication actions stack when needed, and file-details views hide secondary columns. |
| `56rem` | The fragment editor changes from a side-by-side split to a vertical source-page/transcription stack. |

Reader columns remain constrained at wide widths, while forms and dialog surfaces use fluid widths with viewport-safe maximums. Global `focus-visible` treatment uses the dedicated focus token, and icon-only controls provide accessible labels. Error, selection, lock and progress states include text, borders, button state or live-region semantics so colour is not their only signal. Non-essential transitions collapse when `prefers-reduced-motion: reduce` is active.

The Angular client intentionally differs from static `diaries-web` where editing requires Golden Layout tabs and splitters, Quill controls, lock/save indicators, drag handles, file management and marquee manipulation. CDK drag handles are labelled and visually distinct, but reordering remains a pointer/drag interaction; a keyboard reordering command is not currently implemented.

## Useful commands

```bash id="j10t5s"
npm install
npm start
npm run build
npm run watch
npm test
```

## Project structure

The exact source layout may evolve, but the important areas are:

```text id="7m0loa"
src/
  app/
    components/
    services/
    model/
    modes/
  environments/
  styles.scss
public/
angular.json
package.json
```

Typical responsibilities are:

| Area         | Responsibility                                          |
| ------------ | ------------------------------------------------------- |
| components   | UI components and user interaction                      |
| services     | MQTT, authentication, configuration, live-object access |
| model        | Client-side TypeScript model classes/interfaces         |
| modes        | Interaction modes such as view, select, add, edit       |
| environments | Build-time environment configuration                    |

## Relationship to diaries-responder

`diaries-client` should remain consistent with `diaries-responder`.

In particular, both sides should agree on:

* MQTT topic names
* RPC operation names
* request and reply payload shapes
* retained object shapes
* lock/unlock behaviour
* delete/idempotency behaviour
* fragment and marquee ownership rules
* image/file URL conventions

Where possible, server-side validation should be authoritative. The client may prevent invalid actions for usability, but the responder must enforce correctness.

## Further documentation

See also:

```text id="cmzq88"
../README.md
../ARCHITECTURE.md
../diaries-responder/README.md
```


