/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  BooleanCollector,
  DaVinciFieldValidationError,
  LabelCollector,
  PasswordCollector,
  PhoneNumberCollector,
} from '../types';

/**
 * Exhaustive mapper over every `DaVinciFieldValidationError` variant. Adding,
 * removing, or reshaping a variant without updating this switch fails to
 * compile, which is the regression signal this suite is checking for.
 */
function describeValidationError(error: DaVinciFieldValidationError): string {
  switch (error.code) {
    case 'REQUIRED':
      return 'REQUIRED';
    case 'REGEX_ERROR':
      return `REGEX_ERROR:${error.message}`;
    case 'INVALID_LENGTH':
      return `INVALID_LENGTH:${error.min}-${error.max}`;
    case 'UNIQUE_CHARACTER':
      return `UNIQUE_CHARACTER:${error.min}`;
    case 'MAX_REPEAT':
      return `MAX_REPEAT:${error.max}`;
    case 'MIN_CHARACTERS':
      return `MIN_CHARACTERS:${error.character}:${error.min}`;
  }
}

describe('DaVinciFieldValidationError', () => {
  it('supports the REQUIRED and REGEX_ERROR variants', () => {
    expect(describeValidationError({ code: 'REQUIRED' })).toBe('REQUIRED');
    expect(
      describeValidationError({ code: 'REGEX_ERROR', message: 'bad' }),
    ).toBe('REGEX_ERROR:bad');
  });

  it('supports all four native password-policy variants', () => {
    expect(
      describeValidationError({ code: 'INVALID_LENGTH', min: 8, max: 64 }),
    ).toBe('INVALID_LENGTH:8-64');
    expect(describeValidationError({ code: 'UNIQUE_CHARACTER', min: 3 })).toBe(
      'UNIQUE_CHARACTER:3',
    );
    expect(describeValidationError({ code: 'MAX_REPEAT', max: 2 })).toBe(
      'MAX_REPEAT:2',
    );
    expect(
      describeValidationError({
        code: 'MIN_CHARACTERS',
        character: 'digit',
        min: 1,
      }),
    ).toBe('MIN_CHARACTERS:digit:1');
  });
});

describe('BooleanCollector', () => {
  it('keeps display error metadata separate from validate() results', () => {
    const collector: BooleanCollector = {
      key: 'agree',
      type: 'SINGLE_CHECKBOX',
      label: 'I agree',
      required: true,
      value: false,
      appearance: 'CHECKBOX',
      errorMessage: 'This field is required.',
    };

    expect(collector.errorMessage).toBe('This field is required.');
  });
});

describe('PasswordCollector', () => {
  it('declares an optional validation rule with structured errors', () => {
    const collector: PasswordCollector = {
      key: 'password',
      type: 'PASSWORD',
      label: 'Password',
      required: true,
      value: '',
      validation: {
        regex: '^.{8,}$',
        errors: [{ code: 'INVALID_LENGTH', min: 8, max: 64 }],
      },
    };

    expect(collector.validation?.errors).toEqual([
      { code: 'INVALID_LENGTH', min: 8, max: 64 },
    ]);
  });
});

describe('LabelCollector', () => {
  it('declares an optional richContent payload', () => {
    const collector: LabelCollector = {
      key: 'banner',
      type: 'LABEL',
      content: 'Read the {terms}',
      richContent: {
        content: 'Read the {terms}',
        replacements: {
          terms: { value: 'terms', href: 'https://example.com/terms' },
        },
      },
    };

    expect(collector.richContent?.replacements.terms.href).toBe(
      'https://example.com/terms',
    );
  });
});

describe('PhoneNumberCollector', () => {
  it('declares extension, showExtension, and extensionLabel', () => {
    const collector: PhoneNumberCollector = {
      key: 'phone',
      type: 'PHONE_NUMBER',
      label: 'Phone',
      required: true,
      defaultCountryCode: '+1',
      validatePhoneNumber: true,
      countryCode: '+1',
      phoneNumber: '5551234',
      extension: '99',
      showExtension: true,
      extensionLabel: 'Extension',
    };

    expect(collector.extension).toBe('99');
    expect(collector.showExtension).toBe(true);
    expect(collector.extensionLabel).toBe('Extension');
  });

  it('allows extension to be omitted', () => {
    const collector: PhoneNumberCollector = {
      key: 'phone',
      type: 'PHONE_NUMBER',
      label: 'Phone',
      required: true,
      defaultCountryCode: '+1',
      validatePhoneNumber: true,
      countryCode: '+1',
      phoneNumber: '5551234',
      showExtension: false,
      extensionLabel: '',
    };

    expect(collector.extension).toBeUndefined();
  });
});
