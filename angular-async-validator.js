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
                this.run = function (name, value, options) {
                    if (typeof provider.validations[name] === 'undefined' || typeof provider.validations[name].validator !== 'function') {
                        return $q.reject(name + ' isn\'t a registered async validator');
                    }
                    options = angular.extend({}, provider.validations[name].options.options, options);
                    return new $q(function (resolve, reject) {
                        try {
                            resolve(provider.validations[name].validator(value, options));
                        }
                        catch (e) {
                            reject(e);
                        }
                    }).then(function (result) {
                        if (!!result) {
                            return value;
                        }
                        return $q.reject();
                    }, function (err) {
                        if (provider.validations[name].options.silentRejection) {
                            return $q.reject(err);
                        }
                        if (angular.isString(err)) {
                            throw new Error(err);
                        }
                        else {
                            throw err;
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
                    valueFrom: false,
                    options: {},
                    overwrite: true,
                    removeSync: true,
                    silentRejection: true
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
            }
            AsyncForm.prototype.setup = function (callback) {
                var _this = this;
                this.callback = callback;
                if (this.$pending.length > 0) {
                    angular.forEach(this.$pending, function (pending) {
                        _this.add(pending.model, pending.scope, pending.options);
                    });
                    this.$pending.length = 0;
                }
            };
            AsyncForm.prototype.add = function (model, scope, options) {
                if (!this.callback) {
                    this.$pending.push({
                        model: model,
                        scope: scope,
                        options: options
                    });
                    return;
                }
                this.callback(model, scope, options);
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
            angular.forEach(attrs.$attr, function (value, key) {
                var matches;
                if ((matches = value.match(optionsRegex))) {
                    if (matches[1]) {
                        if (typeof (evaled = scope.$eval(attrs[key])) === 'object') {
                            if (typeof opts[matches[1]] !== 'object') {
                                opts[matches[1]] = {};
                            }
                            angular.extend(opts[matches[1]], evaled);
                        }
                    }
                    else {
                        if (typeof (evaled = scope.$eval(attrs[key])) === 'object') {
                            angular.extend(opts['__'], evaled);
                        }
                    }
                }
            });
            return opts;
        }
        function addValidators(validateExpr, AsyncValidator, ctrl, scope, $q, _options) {
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
                var opts = AsyncValidator.options(key), modelOptions = _options['__'], validator = key;
                if (angular.isString(exprssn) && angular.equals(opts, {})) {
                    opts = AsyncValidator.options(exprssn);
                    if (!angular.equals(opts, {})) {
                        validator = exprssn;
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
                else if (typeof _options[key] === 'object') {
                    angular.extend(modelOptions, _options[key]);
                }
                if (typeof _options[validator] === 'object') {
                    angular.extend(modelOptions, _options[validator]);
                }
                ctrl.$asyncValidators[key] = function validationFn(val) {
                    var value;
                    if (opts && opts.valueFrom === false) {
                        value = ctrl;
                    }
                    else if (angular.isString(opts.valueFrom)) {
                        var model = ctrl;
                        if (typeof model[opts.valueFrom] !== 'undefined') {
                            value = model[opts.valueFrom];
                        }
                        else {
                            value = val;
                        }
                    }
                    else {
                        value = val;
                    }
                    if (exprssn === '__VALIDATOR__' || exprssn === validator) {
                        return AsyncValidator.run(validator, value, modelOptions);
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
                    var validateExpr = scope.$eval(attrs['asyncFormValidator']), options = parseOptions(scope, attrs);
                    ctrls[1].setup(function (model, _scope, _options) {
                        addValidators(validateExpr, AsyncValidator, model, _scope, $q, _options);
                    });
                    angular.forEach(ctrls[0], function (model, key) {
                        if (angular.isObject(model) && key.charAt(0) !== '$') {
                            ctrls[1].add(model, scope, options);
                        }
                    });
                    scope.$on('$destroy', function () {
                        ctrls[1].$pending.length = 0;
                        ctrls[1].callback = null;
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
        var AsyncValidatorAdd = (function () {
            function AsyncValidatorAdd() {
                this.restrict = 'A';
                this.require = ['ngModel', '^asyncFormValidator'];
                this.priority = 10;
            }
            AsyncValidatorAdd.prototype.link = function (scope, el, attr, ctrls) {
                ctrls[1].add(ctrls[0], scope, parseOptions(scope, attr));
            };
            AsyncValidatorAdd.instance = function () {
                var _this = this;
                return [function () { return new _this; }];
            };
            return AsyncValidatorAdd;
        })();
        Directives.asyncValidatorAdd = AsyncValidatorAdd.instance();
        var AsyncValidator = (function () {
            function AsyncValidator(AsyncValidator, $q) {
                this.restrict = 'A';
                this.require = 'ngModel';
                this.link = function (scope, el, attrs, ctrl) {
                    var validateExpr = scope.$eval(attrs['asyncValidator']);
                    if (!validateExpr) {
                        return;
                    }
                    addValidators(validateExpr, AsyncValidator, ctrl, scope, $q, parseOptions(scope, attrs));
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
