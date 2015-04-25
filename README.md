[![Build Status](https://travis-ci.org/pocesar/angular-async-validator.svg?branch=master)](https://travis-ci.org/pocesar/angular-async-validator) [![Coverage Status](https://coveralls.io/repos/pocesar/angular-async-validator/badge.svg)](https://coveralls.io/r/pocesar/angular-async-validator)

[![NPM](https://nodei.co/npm/angular-async-validator.png)](https://nodei.co/npm/angular-async-validator/)

Angular Async Validator
=====

This module enables you to register your own validation rules, or overwrite existing ones. Makes every validation 'promise based', so it can deal with both synchronous  and asynchronous validations. Also, sometimes you want validate an entire form when a model changes, which currently there are no good ways to do this, hence this module, because
validation and form manipulation in Angular 1.x is a pain by itself.

Provides no validation functions out-of-the-box. You may reuse the ones from Angular without a problem.

Code was based off [ui-validate](http://angular-ui.github.io/ui-utils/#/validate) initially, but it's too simple and lagging behind still using $parsers and $formatters since it need to retain 1.2 compatibility.

This module requires Angular 1.3+, and has no dependencies other than Angular itself.

It also supports 3rd party promise libraries such as RSVP, Q, Bluebird, etc.

[DEMO](http://embed.plnkr.co/oFVFE7/preview)

## Motivation

Current module implementations only deal with sync validations, validators set in scopes or controllers,
or provide 1 directive for each type of validation (`validate-number`, `validate-presence`, `validate-stuff`, etc), which is an overkill.

Async should be norm, and regardless if the validation itself isn't asynchronous, because the UI is asynchronous afterall. Plus there are a plethora of quality validation Javascript libraries, having to rely on Angular built-in ones is too limited, or you having to write a directive for each validation you need is also overkill.

Main goal is to be able with few reusable directives to rule them all, plus 1 service and 1 provider in a concise
module that does it's job well without all the bells and whistles.

## Usage

```js
angular.module('yourapp', [
   // add this module
   'AsyncValidator'
])
// Configure your validators
.config(['AsyncValidatorProvider', function(AsyncValidatorProvider){

  AsyncValidatorProvider
  // register new reusable validation
  .register('name', ['SomeHttpService', function(SomeHttpService){
    // treat your validator like a service
    return function(model, options){ // receives the full blown ngModelController
      return SomeHttpService.check(model.$modelValue).then(function(returnedFromServer){
        if (returnedFromServer.status === 'ok') {
          return true; // returning boolean is fine, you can throw to break the validation
        }
        return false; // may reject using $q.reject() as well, but since false will forcefully reject the validation
      });
    }
  }])
  // by default, when the validation is truthy, the final AsyncValidator.run() call will have the ngModel.$modelValue


  .register('required', [function(){
    return function(value, options, model){
      // options === {}
      // model.$viewValue / model.$error etc
      return angular.isDefined(value);
    };
  }]) // pluck it out from ngModel, using $$rawModelValue instead of $modelValue, because $modelValue might only be defined after required validation is actually called


  .register('usingValidateJs', [function(){
    return function(value, options){
      if (options.someExtraOptions) {
        console.log('extra options');
      }
      return validate.single(value, {
        presence: true,
        length: {
          minimum: 5
        },
        format: /1910-100/
      });
    };
  }], { options: { someExtraOptions: true} })

  register('equals', function(){
    return function(value, options) {
      if (!angular.isDefined(options.to)) {
        return false;
      }
      return angular.equals(value.$modelValue, options.to);
    };
  })
  ;

}])
// reuse validation programatically
.controller('Ctrl', ['AsyncValidator', function(AsyncValidator){

  AsyncValidator.run('name', 'Validate this string', { inlineOptions: true }).then(function(currentValidValue){
    // worked
    currentValidValue === 'Validate this string'
  }, function(){
    // failed

  });

  this.controllerValidation = function($value){
     return $value === 'asdf';
  };

  this.data = {
      n1: 'asdf',
      n2: '1234',
      n3: 'fsa',
      n4: 'fda',
      n5: 'dsa',
      n6: 'ds',
      n7: 'dsaa',
      value: '2',
      ok: 'ok'
  };

  this.hasChanged = false;
}]);
```

Use it in your HTML input ng-models (notice they are all expressions, therefore need to be a string):

```html
<div ng-controller="Ctrl as ctrl">

   <input
      async-validator="{ required: 'required' }"
      async-validator-options="{ inline: true }"
      ng-model="ctrl.data.n1"
      type="text"
      >

   <input
      async-validator="'$model.$modelValue.length > 3'"
      async-validator-options-validator="{ outline: true }"
      ng-model="ctrl.data.n2"
      type="text"
      >

   <input
      async-validator="['strongpassword','length']"
      ng-model="ctrl.data.n3"
      type="text"
      >

   <input
      async-validator="'equals'"
      async-validator-options-equals="{ to: ctrl.data.n3 }"
      async-validator-watch="ctrl.data.n3"
      ng-model="ctrl.data.n4"
      type="text"
      >

   <input
      async-validator="'nome'"
      async-validator-options-nome="{ forNome: 'ok' }"
      ng-model="ctrl.data.n5"
      type="text"
      >

   <input
      async-validator="{ custom: 'ctrl.controllerValidation($value)' }"
      ng-model="ctrl.data.n6"
      type="text"
      >

   <input
      async-validator="{ inline: '$value != ctrl.data.ok && !$error.required' }"
      required
      ng-model="ctrl.data.n7"
      type="text"
      >
      <!-- can mix synchronous angular validations with async, in this case, using the "required" -->
</div>
```

The helper attribute `async-validator-watch` can watch an expression. If it changes (regardless if truthy or falsy) will trigger the `$validate()` call on the ngModel.

```html
   <input
      async-validator-watch="'ctrl.hasChanged'"
      async-validator="'$model.$viewValue != ctrl.data.value'"
      ng-model="data.n6"
      type="text"
      >
   <input
      async-validator-watch="ctrl.data"
      async-validator="'$model.$viewValue != ctrl.data.value'"
      ng-model="data.n6"
      type="text"
      >
   <input
      async-validator-watch="['ctrl.data','ctrl.hasChanged']"
      async-validator="'$model.$viewValue != ctrl.data.value'"
      ng-model="data.n6"
      type="text"
      >
```

For your own options that apply to all validators, use `async-validator-options="{}"`. If you need to specify specifically for one validator write it as `async-validator-options-REGISTEREDNAME="{}"`. Scope and controller variables can be referenced in the options.

The options goes to the least specific and get merged as it becomes more specific. For example:

```html
  <input
    async-validator="['required','specific']"
    async-validator-options="{lol: 'yes', ok: true}"
    async-validator-options-specific="{ok: false}"
    >
  <!-- required validator will receive the {lol: 'yes', ok: true} -->
  <!-- specific validator will receive the {lol: 'yes', ok: false} -->
```

Locals available:

* `$value` current `$modelValue`, might be undefined / NaN
* `$error` current `$error` in the underlaying ng-model
* `$model` current ng-model exposed
* `$options` current merged `async-validation-options-*`

Use it in your form once and apply the same validation to all underlaying models (must name your inputs or manually add them using `async-validator-add`):

```html
<form async-validator-form="{ required: 'required', dummy: 'ctrl.controllerValidation($value)' }">
  <input
      type="email"
      name="email"
      ng-model"ctrl.data.email">
  <!-- value will have to pass Angular internal required and our registered dummy validator -->

  <input
      type="tel"
      ng-model"ctrl.data.phone"
      async-validator-add
      >
  <!-- value will have to pass Angular internal required and our registered dummy validator -->

  <div async-group-validator="{ required: 'notrequired' }" async-validator-options="{ ok: true }">
    <input
        type="tel"
        ng-model"ctrl.data.street"
        async-validator-add
        >

    <input
        type="text"
        ng-model"ctrl.data.number"
        async-validator-add
        >

    <input
        type="text"
        ng-model"ctrl.data.complement"
        async-validator-exclude
        >

  </div>
</form>
```

## Options

When registering a validator, you can pass your own options to it using the third parameter as an object and setting the `options` member.

* `options` any options that the validator function receives as the second parameter, defaults to `{}`

* `overwrite` if you set to false, it will throw if there's another validator with same name, defaults to `true`

* `removeSync` removes synchronous validators if they have the same name as your registered validator, defaults to `true`. Eg: using `<input ng-model="model" required async-validator="'required'">` will delete the default `required` validator

* `silentRejection` if sets to false, will rethrow the error. will turn any throws and rejections into an "invalid" validation, defaults to true.

## License

MIT
