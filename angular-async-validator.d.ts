export interface IValidationFn {
    (value: string, options?: any, model?: angular.INgModelController): boolean | angular.IPromise<any>;
}
export declare type IValidateFactory = Function | Array<string | Function>;
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
export declare namespace Services {
    class AsyncValidator {
        run: <T>(name: string, value: T, options?: any, model?: angular.INgModelController, returnValue?: boolean) => angular.IPromise<T>;
        options: (name: string) => IOptions;
        validator: (name: string) => IValidationFn;
        constructor($injector: angular.auto.IInjectorService, provider: Providers.AsyncValidatorProvider, $q: angular.IQService);
        static instance(provider: Providers.AsyncValidatorProvider): (string | (($injector: ng.auto.IInjectorService, $q: ng.IQService) => AsyncValidator))[];
    }
}
export declare namespace Providers {
    class AsyncValidatorProvider {
        validations: IValidationRepo;
        defaultOptions: IOptions;
        $get: (string | (($injector: ng.auto.IInjectorService, $q: ng.IQService) => Services.AsyncValidator))[];
        register(name: string, fn: Function | Array<string | Function>, options?: IOptions): AsyncValidatorProvider;
        static instance(): (() => AsyncValidatorProvider)[];
    }
}
