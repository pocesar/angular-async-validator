'use strict';

export interface IValidationFn {
    (value: string, options?: any, model?: angular.INgModelController): boolean|angular.IPromise<any>;
}

export type IValidateFactory = Function|Array<string|Function>;

export interface IValidationRegistered {
    options: IOptions;
    factoryFn?: IValidateFactory;
    validator?: IValidationFn;
}

export interface IValidationRepo {
    [index: string]: IValidationRegistered;
}

export interface IOptions {
    options?: any;
    overwrite?: boolean;
    removeSync?: boolean;
    silentRejection?: boolean;
    returnValue?: boolean;
}

export namespace Services {

    export class AsyncValidator {
        run: <T>(name: string, value: T, options?: any, model?: angular.INgModelController, returnValue?: boolean) => angular.IPromise<T>;
        options: (name: string) => IOptions;
        validator: (name: string) => IValidationFn;

        constructor(
            $injector: angular.auto.IInjectorService,
            provider: Providers.AsyncValidatorProvider,
            $q: angular.IQService
        ) {

            angular.forEach(provider.validations, (validator) => {
                validator.validator = $injector.invoke(<any>validator.factoryFn);
            });

            this.run = <T>(name: string, value: T, options?: any, model?: angular.INgModelController, returnValue?: boolean): angular.IPromise<T> => {
                if (typeof provider.validations[name] === 'undefined' || typeof provider.validations[name].validator !== 'function') {
                    return $q.reject(new Error(`${name} isn't a registered async validator`));
                }

                options = angular.extend({}, provider.validations[name].options.options, options);

                return $q.when(provider.validations[name].validator(<any>value, options, model)).then(function asyncValidatorResolved(result) {
                    if (!!result) {
                        return returnValue === false ? true : (value === undefined ? true : value);
                    }
                    return $q.reject(new Error());
                }, function asyncValidatorRejected(e: any){
                    if (provider.validations[name].options.silentRejection) {
                        return $q.reject(e instanceof Error);
                    }

                    if (e && angular.isString(e)) {
                        throw new Error(e);
                    } else if (e && e instanceof Error) {
                        throw e;
                    } else {
                        return $q.reject(new Error(e));
                    }
                });
            };

            this.validator = (name: string) => {
                if (typeof provider.validations[name] === 'undefined') {
                    return null;
                }
                return provider.validations[name].validator;
            };

            this.options = (name: string) => {
                if (typeof provider.validations[name] === 'undefined') {
                    return {};
                }
                return angular.extend({}, provider.validations[name].options);
            };
        }


        static instance(provider: Providers.AsyncValidatorProvider) {
            return ['$injector', '$q', ($injector: angular.auto.IInjectorService, $q: angular.IQService) => {
                return new this($injector, provider, $q);
            }];
        }

    }

}

export namespace Providers {

    export class AsyncValidatorProvider {
        validations: IValidationRepo = {};
        defaultOptions: IOptions = {
            options: {},
            overwrite: true,
            removeSync: true,
            silentRejection: false,
            returnValue: true
        };

        $get = Services.AsyncValidator.instance(this);

        register(name: string, fn: Function|Array<string|Function>, options: IOptions = {}): AsyncValidatorProvider {
            if (options.overwrite === false && typeof this.validations[name] !== 'undefined') {
                throw new Error(name + ' is already defined');
            }

            this.validations[name] = {
                options: angular.extend({}, this.defaultOptions, options),
                factoryFn: fn,
                validator: null
            };

            return this;
        }

        static instance() {
            return [() => new this];
        }
    }

}

interface IAddCallback extends Function {
    (model: angular.INgModelController, scope: angular.IScope, $attrs: angular.IAttributes): void;
}

interface IPending {
    model: angular.INgModelController;
    scope: angular.IScope;
    attrs: angular.IAttributes;
}

namespace Controllers {

    export class AsyncForm {
        static $inject: string[] = [];
        callback: IAddCallback = null;
        $pending: IPending[] = [];
        $excluded: angular.INgModelController[] = [];

        setup(callback: IAddCallback) {
            this.callback = callback;
            if (this.$pending.length > 0) {
                angular.forEach(this.$pending, (pending) => {
                    this.add(pending.model, pending.scope, pending.attrs);
                });

                this.$pending.length = 0;
            }
        }

        clean() {
            this.$pending.length = 0;
            this.callback = null;
            this.$excluded.length = 0;
        }

        exclude(model: angular.INgModelController): number;
        exclude(model: angular.INgModelController, check: boolean): boolean;
        exclude(model: angular.INgModelController, check?: any): any {
            check = typeof check === 'undefined' ? false : check;
            var expected: boolean = false, position = -1;

            angular.forEach(this.$excluded, (_model, _pos) => {
                if (model === _model) {
                    expected = true;
                    position = _pos;
                }
            });

            if (expected === false && check === false) {
                return this.$excluded.push(model);
            } else if (position > -1 && check === false) {
                this.$excluded.splice(position, 1);
            }

            return expected;
        }

        add(model: angular.INgModelController, scope: angular.IScope, attrs: angular.IAttributes) {
            if (this.exclude(model, true)) {
                return;
            }
            if (!this.callback) {
                this.$pending.push({
                    model,
                    scope,
                    attrs
                });
                return;
            }
            this.callback(model, scope, attrs);
        }

        constructor() { }
    }

}

namespace Directives {

    var optionsRegex = /async-validator-options(?:-)?([^$]*)/;

    function parseOptions(scope: angular.IScope, attrs: angular.IAttributes[]) {
        var opts: any = {'__': {}}, evaled: any;

        angular.forEach(attrs, (attr) => {

            angular.forEach(attr.$attr, (value: string, key: string) => {
                if (!attr[key]) {
                    return;
                }
                var matches: RegExpMatchArray;
                if ((matches = value.match(optionsRegex))) {
                    if (matches[1]) {
                        if (angular.isObject(evaled = scope.$eval(attr[key]))) {
                            if (typeof opts[matches[1]] !== 'object') {
                                opts[matches[1]] = {};
                            }
                            angular.extend(opts[matches[1]], evaled);
                        }
                    } else {
                        if (angular.isObject(evaled = scope.$eval(attr[key]))) {
                            angular.extend(opts['__'], evaled);
                        }
                    }
                }
            });

        });

        return opts;
    }

    function addValidators(
                validateExpr: any,
                AsyncValidator: Services.AsyncValidator,
                ctrl: angular.INgModelController,
                scope: angular.IScope,
                $q: angular.IQService,
                $attrs: angular.IAttributes[]
            ) {

        if (angular.isString(validateExpr)) {
            if (AsyncValidator.validator(validateExpr)) {
                var validatorName = validateExpr;
                validateExpr = {};
                validateExpr[validatorName] = '__VALIDATOR__';
            } else {
                validateExpr = {
                    validator: validateExpr
                };
            }
        }

        angular.forEach(validateExpr, (exprssn: any, key: string) => {
            var
                opts: IOptions = AsyncValidator.options(key),
                validator: string = key,
                alias: any = false;

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
                } else {
                    key = 'validator';
                }
            }

            ctrl.$asyncValidators[key] = function validationFn(val: any) {
                var
                    _options = parseOptions(scope, $attrs),
                    modelOptions: any = angular.extend({}, _options['__']);

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
                } else {
                    var expression = scope.$eval(exprssn, {
                        '$value'  : val,
                        '$model'  : ctrl,
                        '$error'  : ctrl.$error,
                        '$options': modelOptions
                    });

                    return $q.when(expression).then((result) => {
                        if (!!result) {
                            return true;
                        }
                        return $q.reject(new Error());
                    });
                }
            };

            scope.$on('$destroy',  () => {
                if (typeof ctrl.$asyncValidators[key] !== 'undefined') {
                    delete ctrl.$asyncValidators[key];
                }
            });

            if (opts.removeSync) {
                if (typeof ctrl.$validators[key] !== 'undefined') {
                    delete ctrl.$validators[key];
                }
            }
        });

        ctrl.$validate();
    }

    class AsyncFormValidator implements angular.IDirective {
        restrict = 'A';
        require = ['form', 'asyncFormValidator'];
        link: angular.IDirectiveLinkFn;
        controller = Controllers.AsyncForm;

        constructor(AsyncValidator: any, $q: any) {
            this.link = function(scope: angular.IScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrls: any) {
                var
                    validateExpr = scope.$eval(attrs['asyncFormValidator']),
                    ngModel: angular.IFormController = ctrls[0],
                    asyncValidatorCtrl: Controllers.AsyncForm = ctrls[1]
                    ;

                asyncValidatorCtrl.setup((model: any, _scope: angular.IScope, $attrs: angular.IAttributes) => {
                    addValidators(validateExpr, AsyncValidator, model, _scope, $q, [attrs, $attrs]);
                });

                angular.forEach(ngModel, (model: angular.INgModelController, key: string) => {
                    if (angular.isObject(model) && key.charAt(0) !== '$') {
                        asyncValidatorCtrl.add(model, scope, attrs);
                    }
                });

                scope.$on('$destroy', function(){
                    asyncValidatorCtrl.clean();
                });
            };
        }

        static instance(){
            return ['AsyncValidator', '$q', (AsyncValidator: any, $q: any) => new this(AsyncValidator, $q)];
        }
    }

    export var asyncFormValidator: angular.IDirective = AsyncFormValidator.instance();

    class AsyncGroupValidator implements angular.IDirective {
        restrict = 'AE';
        require = ['asyncGroupValidator', '?^asyncFormValidator'];
        link: angular.IDirectiveLinkFn;
        controller = Controllers.AsyncForm;

        constructor(AsyncValidator: any, $q: any) {
            this.link = function(scope: angular.IScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrls: Controllers.AsyncForm[]) {
                var
                    validateExpr = scope.$eval(attrs['asyncGroupValidator']);

                ctrls[0].setup((model: angular.INgModelController, _scope: angular.IScope, $attrs: angular.IAttributes) => {
                    if (ctrls[1]) {
                        ctrls[1].exclude(model);
                    }
                    addValidators(validateExpr, AsyncValidator, model, _scope, $q, [attrs, $attrs]);
                });

                scope.$on('$destroy', function(){
                    ctrls[0].clean();
                });
            };
        }

        static instance() {
                return ['AsyncValidator', '$q', (AsyncValidator: any, $q: any) => new this(AsyncValidator, $q)];
        }
    }

    export var asyncGroupValidator: angular.IDirective = AsyncGroupValidator.instance();

    class AsyncValidatorAdd implements angular.IDirective {
        restrict = 'A';
        require = ['ngModel','?^asyncGroupValidator','?^asyncFormValidator'];
        priority = 10;

        link(scope: angular.IScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrls: any) {
            var
                ngModel: angular.INgModelController = ctrls[0],
                asyncValidatorCtrl: Controllers.AsyncForm = ctrls[1] || ctrls[2];

            if (!asyncValidatorCtrl) {
                return;
            }

            asyncValidatorCtrl.add(ngModel, scope, attrs);

        }

        static instance(){
            return [() => new this];
        }
    }

    export var asyncValidatorAdd: angular.IDirective = AsyncValidatorAdd.instance();

    class AsyncValidatorExclude implements angular.IDirective {
        restrict = 'A';
        priority = 20;
        require = ['ngModel','?^asyncGroupValidator','?^asyncFormValidator'];

        link(scope: angular.IScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrls: any) {
            var
                ngModel: angular.INgModelController = ctrls[0],
                formValidatorCtrl: Controllers.AsyncForm = ctrls[2],
                groupValidatorCtrl: Controllers.AsyncForm = ctrls[1];

            if (formValidatorCtrl) {
                formValidatorCtrl.exclude(ngModel);
            }

            if (groupValidatorCtrl) {
                groupValidatorCtrl.exclude(ngModel);
            }

            scope.$on('$destroy', () => {
                if (formValidatorCtrl) {
                    formValidatorCtrl.exclude(ngModel);
                }

                if (groupValidatorCtrl) {
                    groupValidatorCtrl.exclude(ngModel);
                }
            });
        }

        static instance(){
            return [() => new this];
        }
    }

    export var asyncValidatorExclude: angular.IDirective = AsyncValidatorExclude.instance();

    class AsyncValidator implements angular.IDirective {
        restrict = 'A';
        require = 'ngModel';
        link: angular.IDirectiveLinkFn;

        constructor(AsyncValidator: Services.AsyncValidator, $q: angular.IQService) {

            this.link = (scope: angular.IScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrl: angular.INgModelController) => {
                var
                    validateExpr = scope.$eval(attrs['asyncValidator']);

                if (!validateExpr) {
                    return;
                }

                addValidators(validateExpr, AsyncValidator, ctrl, scope, $q, [attrs]);

                var watches: Function[] = [];

                function watchValues(watch: any) {

                    if (angular.isString(watch)) {
                        watches.push(scope.$watch(watch, function(){
                            ctrl.$validate();
                        }));
                        return;
                    }

                    if (angular.isArray(watch)) {
                        angular.forEach(watch, function(expression){
                            watches.push(scope.$watch(expression, function() {
                                ctrl.$validate();
                            }));
                        });
                        return;
                    }

                    if (angular.isObject(watch)) {
                        watches.push(scope.$watchCollection(watch, function(){
                            ctrl.$validate();
                        }));
                    }

                }

                if (attrs['asyncValidatorWatch']) {
                    watchValues( scope.$eval(attrs['asyncValidatorWatch']) );
                }

                scope.$on('$destroy', () => {
                    angular.forEach(watches, (w) => {
                        w();
                    });
                });
            };

        }

        static instance() {
            return ['AsyncValidator', '$q', (AsyncValidator: any, $q: any) => new this(AsyncValidator, $q)];
        }
    }

    export var asyncValidator: angular.IDirective = AsyncValidator.instance();
}

angular
    .module('AsyncValidator', [])
    .directive(Directives)
    .provider('AsyncValidator', Providers.AsyncValidatorProvider.instance())
    ;
