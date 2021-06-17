# Ordner

A simple file-based router for [Polka](https://github.com/lukeed/polka) inspired by [Sapper](https://sapper.svelte.dev/) and [Svelte Kit](https://kit.svelte.dev/).

![Image](https://i.ibb.co/CBSccLS/ordner.png)

_("Ordner" is German and means "folder")_

**Note: This is an ES6 module.**

1. [Install](#install)
2. [Usage](#usage)
3. [Logging](#logging)
4. [Params](#params)
5. [Handlers](#handlers)
6. [Middlewares](#middlewares)
7. [Hook](#hook)
8. [Hook Recipes](#hook-recipes)

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

Import Ordner and call it with the path of your folder containing the routes as the first argument and your Polka instance as the second one. It returns a promise that resolves when all routes have been mounted:

```js
import polka from "polka";
import ordner from "ordner";

const server = polka();

await ordner("./src/routes", server);

server.listen(3000, () => {
  console.log(`> Running on localhost:3000`);
});
```

**Note:** Make sure to enable ES6 modules project wide by including the following line in your `package.json`:

```
type: "module",
```

## Logging

By default Ordner prints a list of all route handlers and middlewares it found in the specified folder and in the order they are applied to your Polka instance. If you wish to disable logging, e.g. in `production`, you can pass in an object as the third argument and and set `logging` to `false`:

```js
await ordner("./src/routes", server, { logging: false });
```

## Params

To use parameters in your routes simply name your folders and files accordingly. See also [Polka's docs](https://github.com/lukeed/polka#patterns).

```
routes/
├─ blog/
│  ├─ :slug.js
├─ products/
│  ├─ :id.js
├─ users/
│  ├─ :id/
│  │  ├─ index.js
│  │  ├─ orders.js
│  ├─ index.js

```

## Handlers

You export handlers from your `.js` files and name them according to their HTTP method in lowercase. Since `delete` is a reserved keyword in JavaScript, export a function called `del` instead to handle `DELETE` requests.

## Middlewares

To use middlewares every file can export an array named `useBefore`. Middlewares included in this array will be applied before any handler in the current file.

```js
import { json } from "@polka/parse";

export const useBefore = [json()];
```

To use middlewares before a specific handler you can export arrays named `useBeforePost`, `useBeforeGet`, `useBeforePut`, `useBeforePatch`, and `useBeforeDel`.

```js
import { json } from "@polka/parse";

export const useBefore = [json()];

export function get(req, res) {
  res.end("Hello Ordner!");
}

export const useBeforePut = [(req, res, next) => next()];

export function put(req, res) {
  res.end("updated");
}
```

## Hook

You can optionally pass a `hook` function to Ordner which is essentially a wrapper around yout handlers. It allows you easily execute additional code before and after each or just a few specific handlers. The `hook` function takes the `handler` as its only argument and returns a function with the `res` and `req` signature:

```js
import polka from "polka";
import ordner from "ordner";

const hook = (handler) => async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  await handler(req, res);

  console.log("Request completed.");
};

await ordner("./src/routes", server, { hook });

server.listen(3000, () => {
  console.log(`> Running on localhost:3000`);
});
```

**Note 1:** You must call `handler` inside your `hook` function.

**Note 2:** The `hook` is only applied to request handlers not middlewares.

## Hook Recipes

1. Sending responses like in Svelte Kit
2. Obscuring IDs from your database

### Sending responses like in Svelte Kit

To handle responses similar to how you would in Svelte Kit, put the following code into your `hook` function:

```js
const hook = (handler) => async (req, res) => {
  const { status = 200, headers = {}, body } = await handler(req);

  res.writeHead(status, {
    ...headers,
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify(body));
};
```

Now you can simply return a `{ status, body, headers }` object from your handlers:

```js
export function get(req) {
  return {
    body: { message: "Hello Ordner!" },
  };
}
```

### Obscuring IDs from your database

Another useful thing you can do with `hook` is obscuring IDs from your database. Database IDs are usually sequential numbers. Displaying them in your URLs like `/products/17` might tempt your visitors to play around with them in a way you do not want them to. You can use the `hook` function to encode all IDs to something that looks more random before sending a response and decode them again when recieving requests.

```js
// helper function to modify objects even if they contain other objects or arrays
function modifyObj(obj, fn) {
  Object.keys(obj).forEach((key) => {
    const value = obj[key];

    if (value !== null && typeof value === "object") {
      return modifyObj(value, fn);
    }

    if (Array.isArray(value)) {
      return value.forEach((obj) => modifyObj(obj, fn));
    }

    fn(key, obj);
  });
}

function decode(obj) {
  modifyObj(obj, (key, obj) => {
    if (key === "id" || key.endsWith("_id")) {
      obj[key] = Number(Buffer.from(obj[key], "base64").toString("ascii"));
    }
  });
}

function encode(obj) {
  modifyObj(obj, (key, obj) => {
    if (key === "id" || key.endsWith("_id")) {
      obj[key] = Buffer.from(String(obj[key])).toString("base64");
    }
  });
}

const hook = (handler) => async (req, res) => {
  // decode the ID from the incoming request
  decode(req.params);

  // handle the request by the corresponding handler
  let { status = 200, headers = {}, body } = await handler(req);

  // encode all IDs
  encode(body);

  // send the response
  res.writeHead(status, {
    ...headers,
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify(body));
};
```

Create the following route:

`/students/:id.js`

```js
const students = [
  {
    id: 173,
    first_name: "Tony",
    last_name: "Stark",
    school_id: 19,
  },
];

export function get(req) {
  const student = students.find(({ id }) => id === req.params.id);

  return {
    body: student,
  };
}
```

A `GET` request to `/students/MTcz` will now return the following response:

```json
{
  "id": "MTcz",
  "first_name": "Tony",
  "last_name": "Stark",
  "school_id": "MTk="
}
```

The above example uses base 64 encoding. You can also use something like [Hashids](https://hashids.org/) instead, which is more difficult for others to decode.
