/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @fileoverview Standardized Firebase Error.
 *
 * Usage:
 *
 *   // Typescript string literals for type-safe codes
 *   type Err =
 *     'unknown' |
 *     'object-not-found'
 *     ;
 *
 *   // Closure enum for type-safe error codes
 *   // at-enum {string}
 *   var Err = {
 *     UNKNOWN: 'unknown',
 *     OBJECT_NOT_FOUND: 'object-not-found',
 *   }
 *
 *   let errors: Map<Err, string> = {
 *     'generic-error': "Unknown error",
 *     'file-not-found': "Could not find file: {$file}",
 *   };
 *
 *   // Type-safe function - must pass a valid error code as param.
 *   let error = new ErrorFactory<Err>('service', 'Service', errors);
 *
 *   ...
 *   throw error.create(Err.GENERIC);
 *   ...
 *   throw error.create(Err.FILE_NOT_FOUND, {'file': fileName});
 *   ...
 *   // Service: Could not file file: foo.txt (service/file-not-found).
 *
 *   catch (e) {
 *     assert(e.message === "Could not find file: foo.txt.");
 *     if (e.code === 'service/file-not-found') {
 *       console.log("Could not read file: " + e['file']);
 *     }
 *   }
 */
export type ErrorList<T extends string = string> = {
  readonly [K in T]: string
};

const ERROR_NAME = 'FirebaseError';

export interface StringLike {
  toString: () => string;
}

export interface ErrorData {
  [key: string]: StringLike | undefined;
}

export interface FirebaseError {
  // Unique code for error - format is service/error-code-string
  readonly code: string;

  // Developer-friendly error message.
  readonly message: string;

  // Always 'FirebaseError'
  readonly name: typeof ERROR_NAME;

  // Where available - stack backtrace in a string
  readonly stack: string;

  // Additional custom error data that was used in the template.
  readonly data: ErrorData;
}

// Based on code from:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Custom_Error_Types
export class FirebaseError extends Error {
  readonly name = ERROR_NAME;

  constructor(
    readonly code: string,
    message: string,
    readonly data: ErrorData = {}
  ) {
    super(message);

    // Fix For ES5
    // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, FirebaseError.prototype);

    // Maintains proper stack trace for where our error was thrown.
    // Only available on V8.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ErrorFactory.prototype.create);
    }
  }
}

export class ErrorFactory<ErrorCode extends string> {
  constructor(
    private readonly service: string,
    private readonly serviceName: string,
    private readonly errors: ErrorList<ErrorCode>
  ) {}

  create(code: ErrorCode, data: ErrorData = {}): FirebaseError {
    const fullCode = `${this.service}/${code}`;
    const template = this.errors[code];

    const message = template ? replaceTemplate(template, data) : 'Error';

    // Service: Error message (service/code).
    const fullMessage = `${this.serviceName}: ${message} (${fullCode}).`;

    // Keys with an underscore at the end of their name are not included in
    // error.data for some reason.
    const filteredData: ErrorData = {};
    // TODO: Replace with Object.entries when lib is updated to es2017.
    for (const key of Object.keys(data)) {
      if (key.slice(-1) !== '_') {
        filteredData[key] = data[key];
      }
    }
    return new FirebaseError(fullCode, fullMessage, filteredData);
  }
}

function replaceTemplate(template: string, data: ErrorData): string {
  return template.replace(PATTERN, (_, key) => {
    let value = data != null ? data[key] : undefined;
    return value != null ? value.toString() : `<${key}?>`;
  });
}

const PATTERN = /\{\$([^}]+)}/g;
