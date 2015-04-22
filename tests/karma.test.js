describe('AsyncValidator', function () {
    'use strict';

    var expect = chai.expect, $scope, $compile, $rootScope, $q, Provider, $injector, $provide;

    var $exceptionHandler = {
        fn: function(exception, cause) {
            throw exception;
        }
    };

    beforeEach(
        module('AsyncValidator', function(AsyncValidatorProvider, _$provide_){
            Provider = AsyncValidatorProvider;
            $provide = _$provide_;

            $provide.factory('$exceptionHandler', function() {
              return function(exception, cause) {
                return $exceptionHandler.fn(exception, cause);
              };
            });

        })
    );


    function input(inputHtml) {
        var
            el = angular.element(inputHtml),
            compiled = $compile(el);

        return {
            el: el,
            controller: function(){
                return el.controller('ngModel');
            },
            compiled: compiled
        };
    }

    beforeEach(inject(function(_$rootScope_, _$compile_, _$q_, _$injector_) {
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new(true);
        $compile = _$compile_;
        $q = _$q_;
        $injector = _$injector_;
        $scope['data'] = {
            n1: 'asdf',
            n2: '1234',
            n3: 'fsa',
            n4: 'fda',
            n5: 'fda',
            n6: 'ds',
            value: '2',
            ok: 'ok'
        };
    }));

    describe('provider', function(){

        it('should be ok', function(){
            expect(Provider)
                .to.have.ownProperty('validations')
                .and.to.have.ownProperty('defaultOptions')
                .and.to.have.ownProperty('$get')
                .and.to.have.property('register')
                ;
        });

        it('should register validators and work properly', function(done){
            var call = 0, caught = false;

            Provider.register('dummy', function(){
                return function(){
                    call++;
                    return true;
                };
            });
            Provider.register('dummy2', ['$q', function(q){
                expect($q).to.be.equal(q);
                return function(value, options){
                    if (call === 1) {
                        expect(options).to.be.deep.equal({lol: true});
                    } else if (call === 2) {
                        expect(options).to.be.deep.equal({lol: false});
                    }
                    call++;
                    return true;
                };
            }], { options: {lol: true} });
            var fn = function($injector){
                return function(value) {
                    expect(value).to.equal('test');
                    call++;
                    return true;
                }
            }
            fn.$inject = ['$injector'];
            Provider.register('dummy3', fn);
            Provider.register('wontcrash', function(){
                return function(){
                    nope;
                };
            });
            Provider.register('willcrash', function(){
                return function(){
                    nope;
                };
            }, { silentRejection: false });

            expect(function(){
                Provider.register('dummy3', fn, { overwrite: false });
            }).to.throw(/is already defined/);

            sinon.stub($exceptionHandler, 'fn', function(){
                caught = true;
            });

            AsyncValidator = $injector.get('AsyncValidator');

            AsyncValidator.run('dummy', 'test')
            .then(function(){
                return AsyncValidator.run('dummy2', 'test');
            }, done)
            .then(function(){
                return AsyncValidator.run('dummy2', 'test', {lol: false});
            }, done)
            .then(function(){
                return AsyncValidator.run('dummy3', 'test');
            }, done)
            .then(function(){
                expect(call).to.equal(4);
            }, done)
            .then(function(){
                return AsyncValidator.run('doesntExist', 'test');
            })
            .catch(function(err){
                expect(err).to.match(/^doesntExist/);
            })
            .then(function(){
                return AsyncValidator.run('wontcrash', 'test');
            })
            .catch(function(err){
                expect(err).to.match(/nope/);
                return AsyncValidator.run('willcrash','test');
            })
            .catch(function(err){
                expect(caught).to.equal(true);
                $exceptionHandler.fn.restore();
                done();
            });

            $rootScope.$apply();
        });

        describe('directives reusing validators', function(){

            beforeEach(function(){
                Provider.register('fail', function(){
                    return function(){
                        return false;
                    };
                });
                Provider.register('success', function(){
                    return function(){
                        return true;
                    };
                });
            });

            it('should be able to use a plain validator', function(){
                var el = input('<input ng-model="data.ok" async-validator="\'fail\'" />');
                el.compiled($scope);
                $scope.$digest();
                expect(el.controller().$invalid).to.be.equal(true);
                expect(el.controller().$error).to.have.property('fail', true);
                el = input('<input ng-model="data.ok" async-validator="\'success\'" />');
                el.compiled($scope);
                $scope.$digest();
                expect(el.controller().$valid).to.be.equal(true);
                expect(el.controller().$error).to.not.have.property('success');
            });

        });
    });

    describe('directives', function(){
        it('should validate with unamed scope function', function(){
            var el = input('<input ng-model="data.ok" async-validator="\'validation($value)\'" />');

            $scope['validation'] = function($value) {
                expect($value).to.be.equal($scope.data.ok);
                return false;
            };

            el.compiled($scope);
            $scope.$digest();
            expect(el.controller()).to.have.deep.property('$error.validator', true);

            $scope['validation'] = function($value) {
                expect($value).to.be.equal($scope.data.ok);
                return true;
            };
            el.controller().$validate();
            expect(el.controller()).to.not.have.deep.property('$error.validator');
        });

        it('should accept a promise on unamed function', function(){
            var el = input('<input ng-model="data.n1" async-validator="\'validation($model)\'" />');

            $scope['validation'] = function($model) {
                expect($model).to.be.equal(el.controller());
                return $q.when(false);
            };

            el.compiled($scope);
            $scope.$digest();
            expect(el.controller()).to.have.deep.property('$error.validator', true);
        });

        it('should check scope for variables', function(){
            var el = input('<input ng-model="data.n1" async-validator="\'data.n2.length > 4\'" />');

            el.compiled($scope);
            $scope.$digest();
            expect(el.controller()).to.have.deep.property('$error.validator', true);
        });

        it('should work with named expressions', function(){
            var el = input('<input ng-model="data.n1" async-validator="{inline: \'$value.length > 4\'}" />');

            el.compiled($scope);
            $scope.$digest();
            expect(el.controller()).to.have.deep.property('$error.inline', true);
        });

        it('should expose variables $error, $value, $model and $options', function(){
            var el = input('<input ng-model="data.n3" async-validator="{inline: \'$value && $options && $error && $model\'}" />');

            el.compiled($scope);
            $scope.$digest();
            expect(el.controller()).to.not.have.deep.property('$error.inline');
        });

        it('should watch other values and revalidate', function(){
            var
                el = input('<input ng-model="data.n2"  async-validator="{foo: \'false\', bar: \'false\'}" />'),
                el2 = input('<input ng-model="data.n3" async-validator="{inline: \'call(data.n2)\'}" async-validator-watch="\'data.n2\'" />'),
                calls = 0;

            $scope['call'] = function(value){
                calls++;
                if (calls === 1) {
                    expect(value).to.be.equal('1234');
                } else if (calls === 3) {
                    expect(value).to.be.equal(10);
                }
                return value === 10;
            };
            el.compiled($scope);
            el2.compiled($scope);
            $scope.$digest();

            expect(el2.controller()).to.have.deep.property('$error.inline', true);
            expect(el2.controller().$valid).to.equal(false);

            $scope.data.n2 = 10;
            $scope.$digest();
            expect(el2.controller().$valid).to.equal(true);
            expect(el.controller().$invalid).to.equal(true);
            expect(el.controller().$error).to.deep.equal({foo: true, bar: true});
            expect(calls).to.be.equal(3);
        });
    });

    describe('service', function(){

    });
});
