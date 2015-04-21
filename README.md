Angular Async Validator
=====

This module enables you to register your own validation rules, or overwrite existing ones. Makes every validation 'promise based', so it can deal with both synchronous  and asynchronous validations. Also, sometimes you want validate an entire form when a model changes, which currently there are no good ways to do this, hence this module, because 
validation and form manipulation in Angular 1.x is a pain by itself.  

Provides no validation functions out-of-the-box. You may reuse the ones from Angular without a problem. 

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
  
  this.data = {};
}]);
```

Use it in your HTML input ng-models (notice they are all expressions, therefore need to be a string):

```html
<div ng-controller="Ctrl as ctrl">
  <input ng-model="ctrl.data.1" type="text" async-validator="{ required: 'required' }">
  <input ng-model="ctrl.data.2" type="text" async-validator="'$model.$modelValue.length > 10'">
  <input ng-model="ctrl.data.3" type="text" async-validator="'usingValidateJs'">
  <input ng-model="ctrl.data.4" type="text" async-validator="{ custom: 'ctrl.controllerValidation($value)' }">
  <input ng-model="ctrl.data.5" type="text" async-validator="{ inline: '$value != \"ok\" && !$error.required' }">
  <input ng-model="ctrl.data.6" type="text" async-validator="'$model.$viewValue != \"2\"'">
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

## License

MIT
