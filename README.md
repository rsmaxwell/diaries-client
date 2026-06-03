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

## Development notes

When debugging client/server behaviour, consider all of the following together:

* browser console log
* MQTT RPC request and reply messages
* retained topic-tree state
* responder log
* PostgreSQL state
* static file server URLs

Many bugs involve both the Angular client and the Java responder. For example, a UI issue may be caused by a retained topic not being updated, an RPC reply shape changing, a lock/unlock race, or stale selected object state.

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


