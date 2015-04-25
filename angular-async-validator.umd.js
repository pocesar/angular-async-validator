(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AsyncValidator = f()}})(function(){var define,module,exports;module={exports:(exports={})};
var AsyncValidator;
(function (_AsyncValidator) {
    'use strict';
    var Services;
    (function (Services) {
        var AsyncValidator = (function () {
            function AsyncValidator($injector, provider) {
                var $q = $injector.get('$q');
                angular.forEach(provider.validations, function (validator) {
                    validator.validator = $injector.invoke(validator.factoryFn);
                });
                this.run = function (name, value, options, model, returnValue) {
                    if (typeof provider.validations[name] === 'undefined' || typeof provider.validations[name].validator !== 'function') {
                        return $q.reject("" + name + " isn't a registered async validator");
                    }
                    options = angular.extend({}, provider.validations[name].options.options, options);
                    return new $q(function asyncValidatorRunResolver(resolve) {
                        resolve(provider.validations[name].validator(value, options, model));
                    }).then(function asyncValidatorResolved(result) {
                        if (!!result) {
                            return returnValue === false ? true : value;
                        }
                        return $q.reject();
                    }, function asyncValidatorRejected(e) {
                        if (provider.validations[name].options.silentRejection) {
                            return $q.reject(e);
                        }
                        if (angular.isString(e)) {
                            throw new Error(e);
                        }
                        else {
                            throw e;
                        }
                    });
                };
                this.validator = function (name) {
                    if (typeof provider.validations[name] === 'undefined') {
                        return null;
                    }
                    return provider.validations[name].validator;
                };
                this.options = function (name) {
                    if (typeof provider.validations[name] === 'undefined') {
                        return {};
                    }
                    return angular.extend({}, provider.validations[name].options);
                };
            }
            AsyncValidator.instance = function (provider) {
                var _this = this;
                return ['$injector', function ($injector) {
                    return new _this($injector, provider);
                }];
            };
            return AsyncValidator;
        })();
        Services.AsyncValidator = AsyncValidator;
    })(Services = _AsyncValidator.Services || (_AsyncValidator.Services = {}));
    var Providers;
    (function (Providers) {
        var AsyncValidatorProvider = (function () {
            function AsyncValidatorProvider() {
                this.validations = {};
                this.defaultOptions = {
                    options: {},
                    overwrite: true,
                    removeSync: true,
                    silentRejection: true,
                    returnValue: true
                };
                this.$get = Services.AsyncValidator.instance(this);
            }
            AsyncValidatorProvider.prototype.register = function (name, fn, options) {
                if (options === void 0) { options = {}; }
                if (options.overwrite === false && typeof this.validations[name] !== 'undefined') {
                    throw new Error(name + ' is already defined');
                }
                this.validations[name] = {
                    options: angular.extend({}, this.defaultOptions, options),
                    factoryFn: fn,
                    validator: null
                };
                return this;
            };
            AsyncValidatorProvider.instance = function () {
                var _this = this;
                return [function () { return new _this; }];
            };
            return AsyncValidatorProvider;
        })();
        Providers.AsyncValidatorProvider = AsyncValidatorProvider;
    })(Providers = _AsyncValidator.Providers || (_AsyncValidator.Providers = {}));
    var Controllers;
    (function (Controllers) {
        var AsyncForm = (function () {
            function AsyncForm() {
                this.callback = null;
                this.$pending = [];
                this.$excluded = [];
            }
            AsyncForm.prototype.setup = function (callback) {
                var _this = this;
                this.callback = callback;
                if (this.$pending.length > 0) {
                    angular.forEach(this.$pending, function (pending) {
                        _this.add(pending.model, pending.scope, pending.attrs);
                    });
                    this.$pending.length = 0;
                }
            };
            AsyncForm.prototype.clean = function () {
                this.$pending.length = 0;
                this.callback = null;
                this.$excluded.length = 0;
            };
            AsyncForm.prototype.exclude = function (model, check) {
                check = typeof check === 'undefined' ? false : check;
                var expected = false, position = -1;
                angular.forEach(this.$excluded, function (_model, _pos) {
                    if (model === _model) {
                        expected = true;
                        position = _pos;
                    }
                });
                if (expected === false && check === false) {
                    return this.$excluded.push(model);
                }
                else if (position > -1 && check === false) {
                    this.$excluded.splice(position, 1);
                }
                return expected;
            };
            AsyncForm.prototype.add = function (model, scope, attrs) {
                if (this.exclude(model, true)) {
                    return;
                }
                if (!this.callback) {
                    this.$pending.push({
                        model: model,
                        scope: scope,
                        attrs: attrs
                    });
                    return;
                }
                this.callback(model, scope, attrs);
            };
            AsyncForm.$inject = [];
            return AsyncForm;
        })();
        Controllers.AsyncForm = AsyncForm;
    })(Controllers || (Controllers = {}));
    var Directives;
    (function (Directives) {
        var optionsRegex = /async-validator-options(?:-)?([^$]*)/;
        function parseOptions(scope, attrs) {
            var opts = { '__': {} }, evaled;
            angular.forEach(attrs, function (attr) {
                angular.forEach(attr.$attr, function (value, key) {
                    if (!attr[key]) {
                        return;
                    }
                    var matches;
                    if ((matches = value.match(optionsRegex))) {
                        if (matches[1]) {
                            if (angular.isObject(evaled = scope.$eval(attr[key]))) {
                                if (typeof opts[matches[1]] !== 'object') {
                                    opts[matches[1]] = {};
                                }
                                angular.extend(opts[matches[1]], evaled);
                            }
                        }
                        else {
                            if (angular.isObject(evaled = scope.$eval(attr[key]))) {
                                angular.extend(opts['__'], evaled);
                            }
                        }
                    }
                });
            });
            return opts;
        }
        function addValidators(validateExpr, AsyncValidator, ctrl, scope, $q, $attrs) {
            if (angular.isString(validateExpr)) {
                if (AsyncValidator.validator(validateExpr)) {
                    var validatorName = validateExpr;
                    validateExpr = {};
                    validateExpr[validatorName] = '__VALIDATOR__';
                }
                else {
                    validateExpr = {
                        validator: validateExpr
                    };
                }
            }
            angular.forEach(validateExpr, function (exprssn, key) {
                var opts = AsyncValidator.options(key), validator = key, alias = false;
                if (angular.isString(exprssn) && angular.equals(opts, {})) {
                    opts = AsyncValidator.options(exprssn);
                    if (!angular.equals(opts, {})) {
                        validator = exprssn;
                        alias = key;
                        exprssn = '__VALIDATOR__';
                    }
                }
                if (angular.isNumber(key)) {
                    if (angular.isString(validator)) {
                        key = validator;
                    }
                    else {
                        key = 'validator';
                    }
                }
                ctrl.$asyncValidators[key] = function validationFn(val) {
                    var _options = parseOptions(scope, $attrs), modelOptions = angular.extend({}, _options['__']);
                    if (angular.isString(alias) && typeof _options[alias] === 'object') {
                        angular.extend(modelOptions, _options[alias]);
                    }
                    if (typeof _options[key] === 'object') {
                        angular.extend(modelOptions, _options[key]);
                    }
                    if (typeof _options[validator] === 'object') {
                        angular.extend(modelOptions, _options[validator]);
                    }
                    if (exprssn === '__VALIDATOR__' || exprssn === validator) {
                        return AsyncValidator.run(validator, val, modelOptions, ctrl, false);
                    }
                    else {
                        var expression = scope.$eval(exprssn, {
                            '$value': val,
                            '$model': ctrl,
                            '$error': ctrl.$error,
                            '$options': modelOptions
                        });
                        return $q.when(expression).then(function (result) {
                            if (!!result) {
                                return true;
                            }
                            return $q.reject();
                        }, function (err) {
                            return $q.reject(err);
                        });
                    }
                };
                if (opts.removeSync) {
                    if (typeof ctrl.$validators[key] !== 'undefined') {
                        delete ctrl.$validators[key];
                    }
                }
                ctrl.$validate();
            });
        }
        var AsyncFormValidator = (function () {
            function AsyncFormValidator(AsyncValidator, $q) {
                this.restrict = 'A';
                this.require = ['form', 'asyncFormValidator'];
                this.controller = Controllers.AsyncForm;
                this.link = function (scope, el, attrs, ctrls) {
                    var validateExpr = scope.$eval(attrs['asyncFormValidator']), ngModel = ctrls[0], asyncValidatorCtrl = ctrls[1];
                    asyncValidatorCtrl.setup(function (model, _scope, $attrs) {
                        addValidators(validateExpr, AsyncValidator, model, _scope, $q, [attrs, $attrs]);
                    });
                    angular.forEach(ngModel, function (model, key) {
                        if (angular.isObject(model) && key.charAt(0) !== '$') {
                            asyncValidatorCtrl.add(model, scope, attrs);
                        }
                    });
                    scope.$on('$destroy', function () {
                        asyncValidatorCtrl.clean();
                    });
                };
            }
            AsyncFormValidator.instance = function () {
                var _this = this;
                return ['AsyncValidator', '$q', function (AsyncValidator, $q) { return new _this(AsyncValidator, $q); }];
            };
            return AsyncFormValidator;
        })();
        Directives.asyncFormValidator = AsyncFormValidator.instance();
        var AsyncGroupValidator = (function () {
            function AsyncGroupValidator(AsyncValidator, $q) {
                this.restrict = 'AE';
                this.require = ['asyncGroupValidator', '?^asyncFormValidator'];
                this.controller = Controllers.AsyncForm;
                this.link = function (scope, el, attrs, ctrls) {
                    var validateExpr = scope.$eval(attrs['asyncGroupValidator']);
                    ctrls[0].setup(function (model, _scope, $attrs) {
                        if (ctrls[1]) {
                            ctrls[1].exclude(model);
                        }
                        addValidators(validateExpr, AsyncValidator, model, _scope, $q, [attrs, $attrs]);
                    });
                    scope.$on('$destroy', function () {
                        ctrls[0].clean();
                    });
                };
            }
            AsyncGroupValidator.instance = function () {
                var _this = this;
                return ['AsyncValidator', '$q', function (AsyncValidator, $q) { return new _this(AsyncValidator, $q); }];
            };
            return AsyncGroupValidator;
        })();
        Directives.asyncGroupValidator = AsyncGroupValidator.instance();
        var AsyncValidatorAdd = (function () {
            function AsyncValidatorAdd() {
                this.restrict = 'A';
                this.require = ['ngModel', '?^asyncGroupValidator', '?^asyncFormValidator'];
                this.priority = 10;
            }
            AsyncValidatorAdd.prototype.link = function (scope, el, attrs, ctrls) {
                var ngModel = ctrls[0], asyncValidatorCtrl = ctrls[1] || ctrls[2];
                if (!asyncValidatorCtrl) {
                    return;
                }
                asyncValidatorCtrl.add(ngModel, scope, attrs);
            };
            AsyncValidatorAdd.instance = function () {
                var _this = this;
                return [function () { return new _this; }];
            };
            return AsyncValidatorAdd;
        })();
        Directives.asyncValidatorAdd = AsyncValidatorAdd.instance();
        var AsyncValidatorExclude = (function () {
            function AsyncValidatorExclude() {
                this.restrict = 'A';
                this.priority = 20;
                this.require = ['ngModel', '?^asyncGroupValidator', '?^asyncFormValidator'];
            }
            AsyncValidatorExclude.prototype.link = function (scope, el, attrs, ctrls) {
                var ngModel = ctrls[0], formValidatorCtrl = ctrls[2], groupValidatorCtrl = ctrls[1];
                if (formValidatorCtrl) {
                    formValidatorCtrl.exclude(ngModel);
                }
                if (groupValidatorCtrl) {
                    groupValidatorCtrl.exclude(ngModel);
                }
                scope.$on('$destroy', function () {
                    if (formValidatorCtrl) {
                        formValidatorCtrl.exclude(ngModel);
                    }
                    if (groupValidatorCtrl) {
                        groupValidatorCtrl.exclude(ngModel);
                    }
                });
            };
            AsyncValidatorExclude.instance = function () {
                var _this = this;
                return [function () { return new _this; }];
            };
            return AsyncValidatorExclude;
        })();
        Directives.asyncValidatorExclude = AsyncValidatorExclude.instance();
        var AsyncValidator = (function () {
            function AsyncValidator(AsyncValidator, $q) {
                this.restrict = 'A';
                this.require = 'ngModel';
                this.link = function (scope, el, attrs, ctrl) {
                    var validateExpr = scope.$eval(attrs['asyncValidator']);
                    if (!validateExpr) {
                        return;
                    }
                    addValidators(validateExpr, AsyncValidator, ctrl, scope, $q, [attrs]);
                    var watches = [];
                    function watchValues(watch) {
                        if (angular.isString(watch)) {
                            watches.push(scope.$watch(watch, function () {
                                ctrl.$validate();
                            }));
                            return;
                        }
                        if (angular.isArray(watch)) {
                            angular.forEach(watch, function (expression) {
                                watches.push(scope.$watch(expression, function () {
                                    ctrl.$validate();
                                }));
                            });
                            return;
                        }
                        if (angular.isObject(watch)) {
                            watches.push(scope.$watchCollection(watch, function () {
                                ctrl.$validate();
                            }));
                        }
                    }
                    if (attrs['asyncValidatorWatch']) {
                        watchValues(scope.$eval(attrs['asyncValidatorWatch']));
                    }
                    scope.$on('$destroy', function () {
                        ctrl.$asyncValidators = {};
                        angular.forEach(watches, function (w) {
                            w();
                        });
                    });
                };
            }
            AsyncValidator.instance = function () {
                var _this = this;
                return ['AsyncValidator', '$q', function (AsyncValidator, $q) { return new _this(AsyncValidator, $q); }];
            };
            return AsyncValidator;
        })();
        Directives.asyncValidator = AsyncValidator.instance();
    })(Directives || (Directives = {}));
    angular.module('AsyncValidator', []).directive(Directives).provider('AsyncValidator', Providers.AsyncValidatorProvider.instance());
})(AsyncValidator || (AsyncValidator = {}));
module.exports = AsyncValidator;

return module.exports;});
