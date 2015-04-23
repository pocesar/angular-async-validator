declare module AsyncValidator {
    interface IValidationFn {
        (value: string | angular.INgModelController, options?: any): boolean | angular.IPromise<any>;
    }
    type IValidateFactory = Function | Array<string | Function>;
    interface IValidationRegistered {
        options: IOptions;
        factoryFn?: IValidateFactory;
        validator?: IValidationFn;
    }
    interface IValidationRepo {
        [index: string]: IValidationRegistered;
    }
    interface IOptions {
        valueFrom?: boolean | string;
        options?: any;
        overwrite?: boolean;
        removeSync?: boolean;
        silentRejection?: boolean;
        returnValue?: boolean;
    }
    module Services {
        class AsyncValidator {
            run: <T>(name: string, value: T, options?: any, returnValue?: boolean) => angular.IPromise<T>;
            options: (name: string) => IOptions;
            validator: (name: string) => IValidationFn;
            constructor($injector: angular.auto.IInjectorService, provider: Providers.AsyncValidatorProvider);
            static instance(provider: Providers.AsyncValidatorProvider): (string | (($injector: ng.auto.IInjectorService) => AsyncValidator))[];
        }
    }
    module Providers {
        class AsyncValidatorProvider {
            validations: IValidationRepo;
            defaultOptions: IOptions;
            $get: (string | (($injector: ng.auto.IInjectorService) => Services.AsyncValidator))[];
            register(name: string, fn: Function | Array<string | Function>, options?: IOptions): AsyncValidatorProvider;
            static instance(): (() => AsyncValidatorProvider)[];
        }
    }
}
export = AsyncValidator;
