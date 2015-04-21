Angular Async Validator
=====

This module enables you to register your own validation rules, or overwrite existing ones. Makes every validation 'promise based', so it can deal with both synchronous  and asynchronous validations. Also, sometimes you want validate an entire form when a model changes, which currently there are no good ways to do this, hence this module, because 
validation and form manipulation in Angular 1.x is a pain by itself.  

Provides no validation functions out-of-the-box. You may reuse the ones from Angular without a problem. 

Requires Angular 1.3+

## Motivation

Current module implementations only deal with sync validations, validators set in scopes or controllers, 
or provide 1 directive for each type of validation, which is an overkill. 

Async should be norm, and regardless if the validation itself isn't asynchronous, because the UI is asynchronous afterall. Plus there are a plethora of validation libraries, having to rely on Angular built-in ones is too limited, or having to write a directive for each validation you need is also overkill.

Main goal is to be able to created two directives to rule them all, plus 1 service and 1 provider in a concise 
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
    return function(value, options){
      // options === {}
      return angular.isDefined(value);
    };
  }], { valueFrom: '$$rawModelValue' }) // pluck it out from ngModel, using $$rawModelValue instead of $modelValue, because $modelValue might only be defined after required validation is actually called


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
  }], { valueFrom: '$viewValue', options: { someExtraOptions: true} });
  ;
  
}])
// reuse validation programatically
.controller('Ctrl', ['AsyncValidator', function(AsyncValidator){

  AsyncValidator.run('name', 'Validate this string', { inlineOptions: true }).then(function(currentValidValue){
    // worked
    currentValidValue
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
      n5: 'fda',
      n6: 'ds',
      value: '2',
      ok: 'ok'  
  };
}]);
```

Use it in your HTML input ng-models (notice they are all expressions, therefore need to be a string):

```html
<div ng-controller="Ctrl as ctrl">
   <input async-validator="{ required: 'required' }" ng-model="ctrl.data.n1" type="text">
   <input async-validator="'$model.$modelValue.length > 3'" ng-model="ctrl.data.n2" type="text">
   <input async-validator="'nome'" ng-model="ctrl.data.n3" type="text">
   <input async-validator="{ custom: 'ctrl.controllerValidation($value)' }" ng-model="ctrl.data.n4" type="text">
   <input async-validator="{ inline: '$value != ok && !$error.required' }" required ng-model="ctrl.data.n5" type="text" >
   <input async-validator="'$model.$viewValue != ctrl.data.value'" ng-model="data.n6" type="text">
</div>
```

Locals available:

* `$value` current `$modelValue`, might be undefined
* `$error` current `$error` in the underlaying ng-model
* `$model` current ng-model exposed

Use it in your form once and apply the same validation to all underlaying models (must name your inputs or manually add them using `async-validator-add`):

```html
<form async-validator-form="{ required: 'required', dummy: 'ctrl.controllerValidation($value)' }">
  <input type="email" name="email" ng-model"ctrl.data.email">
  <input type="tel" ng-model"ctrl.data.phone" async-validator-add>
</form>
```

## Options

When registering a validator, you can pass your own options to it using the third parameter as an object and setting the `options` member. 

* `valueFrom` where to get the current value. Defaults to `undefined`, and passes the whole ngModelController to the validator function as the first parameter
* `options` any options that the validator function receives as the second parameter, defaults to `{}`
* `overwrite` if you set to false, it will throw if there's another validator with same name, defaults to `true`
* `removeSync` will not remove synchronous validators if they have the same name, defaults to `false` (removes validators with same name)
* `silentRejection` if sets to false, will rethrow the error. will turn any throws and rejections into an "invalid" validation, defaults to true. 

## License

MIT
