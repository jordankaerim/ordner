# Ordner

A simple file-based router for [Polka](https://github.com/lukeed/polka) inspired by [Sapper](https://sapper.svelte.dev/) and [Svelte Kit](https://kit.svelte.dev/).

![Image](https://i.ibb.co/CBSccLS/ordner.png)

("Ordner" is German and means "folder")

**Note: This is an ES6 module.**

## Install

```
npm install ordner
```

## Usage

Create your folder structure:

```
src/
├─ routes/
│  ├─ users/
│  │  ├─ index.js
│  │  ├─ :id.js
├─ index.js
```

Import Ordner and call it with the folder path containing your routes as the first argument and your Polka instance as the second one. It returns a promise that resolves when all routes have been mounted:

```js
import polka from "polka";
import ordner from "ordner";

const server = polka();

ordner("./src/routes", server).then(() => {
  server.listen(3000, () => {
    console.log(`> Running on localhost:3000`);
  });
});
```

**Note:** Make sure to enable ES6 modules project wide by including the following line in your `package.json`:

```
type: "module",
```

## Logging

By default Ordner prints a list of all route handlers and middlewares it found in the specified folder and in the order they are mounted to the polka server. If you wish to disable logging, e.g. in `production`, you can turn it off by setting `logging` to `false`:

```js
ordner("./src/routes", server, { logging: false });
```

## Params

To use parameters in your routes simply name your folders and files accordingly. See also [Polka's docs](https://github.com/lukeed/polka#patterns).

```
src/
├─ routes/
│  ├─ users/
│  │  ├─ index.js
│  │  ├─ :id.js
├─ index.js
```

## Handlers

You export handlers from your files Since `delete` is a reserved keyword in JavaScript, export a function called `del` instead to handle `DELETE` requests.

## Middlewares

To use middlewares every file can export an array of middlewares named `useBefore`. Middlewares included in this array will be mounted before any handler in the current file.

```js
import { json } from "@polka/parse";

export const useBefore = [json()];
```

To use middlewares before a specific handler you can use `useBeforePost`, `useBeforeGet`, `useBeforePut`, `useBeforePatch`, and `useBeforeDel`.

```js
import { json } from "@polka/parse";

export const useBefore = [json()];

export function get(req, res, next) {
  res.end("Hello Ordner!");
}

export const useBeforePut = [(req, res, next) => next()];

export function put(req, res) {
  res.end("updated");
}
```

## Hook

You can optionally pass a `hook` function to Ordner which is essentially a middleware wrapped around every single handler. It is useful for e.g. error handling. The `hook` function takes the `handler` as its only argument and returns a function with the `res`, `req` and `next` signature:

```js
import polka from "polka";
import ordner from "ordner";

const hook = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

ordner("./src/routes", server).then(() => {
  server.listen(3000, () => {
    console.log(`> Running on localhost:3000`);
  });
});
```

## Svelte Kit like responses

To handle responses like in Svelte Kit, simply put the following code into your `hook` function:

```js
const hook = (handler) => async (req, res, next) => {
  const { status = 200, headers = {}, body } = await handler(req, res, next);

  res.writeHead(status, {
    ...headers,
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify(body));
};
```

Now you can just return a `{ status, body, headers }` object from your handlers, like you do in Svelte Kit:

```js
export function get(req) {
  return {
    body: { message: "Hello Ordner!" },
  };
}
```
