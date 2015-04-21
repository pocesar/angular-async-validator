Angular Async Validator
=====

Provides no validation functions out-of-the-box. It enables you to register your own validation rules, 
or overwrite existing ones. Makes every validation 'promise based', so it can deal with both synchronous 
and asynchronous validations. Also, sometimes you want validate an entire form when a model changes, 
which currently there are no good ways to do this, hence this module.  

## Motivation

Current module implementations only deal with sync validations, validators set in scopes or controllers, 
or provide 1 directive for each type of validation, which is an overkill. Async should be norm, and regardless if
the validation itself isn't asynchronous, because the UI is asynchronous afterall. Plus there are a plethora of 
validation libraries, having to rely on Angular built-in ones is too limited, or having to write a directive for
each validation you need is also overkill.

## Usage



## License

MIT
