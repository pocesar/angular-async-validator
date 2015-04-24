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

    afterEach(function(){
        if ($exceptionHandler.fn.restore) {
            $exceptionHandler.fn.restore();
        }
    });


    function input(inputHtml) {
        var
            el = angular.element(inputHtml),
            compiled = $compile(el);

        return {
            el: el,
            controller: function(ctrl){
                return el.controller(ctrl ? ctrl : 'ngModel');
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
            n5: 'hsfg',
            n6: 'ds',
            value: '2',
            ok: 'ok'
        };
    }));

    describe('AsyncValidatorProvider and AsyncValidator', function(){

        it('should be ok', function(){
            expect(Provider)
                .to.have.ownProperty('validations')
                .and.to.have.ownProperty('defaultOptions')
                .and.to.have.ownProperty('$get')
                .and.to.have.property('register')
                ;
        });

        it('should register validators and work properly', function(done){
            var call = 0;

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
            Provider.register('rejectionError', function(){
                return function(){
                    return $q.reject(new Error('oh my'));
                };
            }, { silentRejection: false });
            Provider.register('forcereject', function(){
                return function(){
                    return $q.reject('ok');
                };
            }, { silentRejection: false });
            Provider.register('forcesilencereject', function(){
                return function(){
                    return $q.reject('ok');
                };
            });

            expect(function(){
                Provider.register('dummy3', fn, { overwrite: false });
            }).to.throw(/is already defined/);

            sinon.stub($exceptionHandler, 'fn', function(err){
                if ($exceptionHandler.fn.callCount > 4) {
                    throw err;
                }
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
            .catch(function(err) {
                expect($exceptionHandler.fn.args[0][0]).to.match(/nope/);
                return AsyncValidator.run('forcereject','test');
            })
            .catch(function(err){
                return AsyncValidator.run('forcesilencereject','test');
            })
            .catch(function(err){
                expect(err).to.match(/ok/);
                return AsyncValidator.run('rejectionError');
            })
            .catch(function(err){
                expect($exceptionHandler.fn.callCount).to.equal(4);
                expect($exceptionHandler.fn.args[2][0]).to.match(/ok/);
                expect($exceptionHandler.fn.args[3][0]).to.match(/oh my/);
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

    describe('async-validator', function(){
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

        it('should work with arrays', function(){
            $scope['ok'] = sinon.stub().returns(true);

            var el = input('<input ng-model="data.n1" async-validator="[\'ok(1)\', \'ok(2)\']" />');

            el.compiled($scope);
            $scope.$digest();

            expect($scope['ok'].args[0][0]).to.be.equal(2); // translates to "validator"
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

            el2 = input('<input ng-model="data.n3" async-validator="{inline: \'call(data.n2)\'}" async-validator-watch="[\'data.n2\',\'data.n4\']" />'),
            el2.compiled($scope);
            $scope.$digest();
            expect(calls).to.be.equal(6);

            el2 = input('<input ng-model="data.n3" async-validator="{inline: \'call(data.n2)\'}" async-validator-watch="data" />'),
            el2.compiled($scope);
            $scope.$digest();

            el2 = input('<input ng-model="data.n3" async-validator="{inline: \'call(data.n2)\'}" async-validator-watch="false" />'),
            el2.compiled($scope);
            $scope.$digest();
        });

        it('can recover from bad valueFrom', function(){
            var invalidSpy = sinon.stub().returns(true);;

            Provider.register('invalidFrom', function(){
                return invalidSpy;
            }, { valueFrom: 'nope' });

            var
                el = input('<input ng-model="data.n2"  async-validator="\'invalidFrom\'" />');

            el.compiled($scope);
            $scope.$digest();

            expect(invalidSpy.args[0][0]).to.be.equal($scope.data.n2);
        });

        it('can handle rejections inside scope functions', function(){
            var invalidSpy = sinon.stub().returns($q.reject(new Error('uhoh')));

            $scope['ok'] = invalidSpy;

            var
                el = input('<input ng-model="data.n2"  async-validator="\'ok()\'" />');

            el.compiled($scope);
            $scope.$digest();

            expect(el.controller()).to.have.deep.property('$error.validator', true);
        });

        it('should propagate errors as usual', function(){
            var invalidSpy = sinon.stub().throws(new Error('uhoh'));

            $scope['ok'] = invalidSpy;

            sinon.stub($exceptionHandler, 'fn', function(){});

            var
                el = input('<input ng-model="data.n2"  async-validator="\'ok($value)\'" />');

            el.compiled($scope);
            $scope.$digest();

            expect($exceptionHandler.fn.args[0][0]).to.match(/uhoh/);
        });

        it('ignores invalid expressions', function(){
           var
                el = input('<input ng-model="data.n2" async-validator="undefined" />');

            el.compiled($scope);
            $scope.$digest();

            expect(el.controller().$asyncValidators).to.deep.equal({});
        });

        it('destroying scope frees the watchers', function(){
            $scope['one'] = 1;
            $scope['two'] = 2;
            $scope['ok'] = sinon.stub.returns(true);

            sinon.stub($exceptionHandler, 'fn', function(){});

            var
                el = input('<input ng-model="data.n2" async-validator-watch="[\'one\',\'two\']"  async-validator="\'ok($value)\'" />');

            el.compiled($scope);
            $scope.$digest();

            $scope.one = 2;
            $scope.two = 3;
            $scope.$digest();
            expect(el.controller().$asyncValidators).to.have.property('validator');
            $scope.$destroy();

            expect(el.controller().$asyncValidators).to.deep.equal({});
        });

        it('removes synchronous validators with same name', function(){
            Provider.register('required', function(){
                return function(){
                    return true;
                };
            });

            var
                el = input('<input ng-model="data.n2"  async-validator="{required: \'required()\'}" required />');

            el.compiled($scope);
            $scope.$digest();

            expect(el.controller()).to.not.have.deep.property('$validators.required');
            expect(el.controller()).to.have.deep.property('$asyncValidators.required');
        });

        describe('async-form-validator', function(){

            it('adds all named models', function(){
                Provider.register('required', function(){
                    return function(){
                        return false;
                    };
                });

                $scope['ok'] = sinon.stub().returns(true);

                var el = input('<form async-form-validator="[\'required\',\'ok()\']"><input ng-model="data.n4" name="n4"><input ng-model="data.n5" name="n5"></form>');

                el.compiled($scope);
                $scope.$digest();

                expect(el.controller('form')).to.have.deep.property('$error.required').and.to.have.length(2);
                expect(el.controller('form')).to.have.deep.property('$$success.validator').and.to.have.length(2);
                expect($scope['ok'].callCount).to.equal(2);
            });

            it('add models using async-validator-add', function(){
                $scope['ok'] = sinon.stub().returns(true);

                var el = input('<form async-form-validator="{ required: \'ok($value, $options)\' }"><input ng-model="data.n4" async-validator-options="{hola: true}" async-validator-add><input ng-model="data.n5" async-validator-add></form>');

                el.compiled($scope);
                $scope.$digest();

                expect(el.controller('form')).to.have.deep.property('$$success.required').and.to.have.length(2);
                expect($scope['ok'].callCount).to.equal(2);
                expect($scope['ok'].args[0]).to.deep.equal([$scope.data.n4, {hola: true}]);
                expect($scope['ok'].args[1]).to.deep.equal([$scope.data.n5, {}]);

                $scope.$destroy();
            });

        });

        describe('async-validator-options', function(){

            it('should pass scope variables through options', function(){
                var spy = sinon.spy();

                Provider.register('dummy', function(){
                    return function(value, options){
                        spy({value: value, options: options});
                        return true;
                    };
                }, { valueFrom: '$modelValue' });

                var el = input('<input ng-model="data.n2" async-validator="{notdummy:\'dummy\'}" async-validator-options="{to: data.n3}">');
                el.compiled($scope);
                $scope.$digest();

                expect(spy.getCall(0).args[0]).to.deep.equal({value: $scope.data.n2, options: { to: $scope.data.n3 } });
                expect(el.controller()).to.have.deep.property('$$success.notdummy', true);

                spy.reset();

                el = input('<input ng-model="data.n2" async-validator="{notdummy:\'dummy\'}" async-validator-options-notdummy="{to: data.n3}">');
                el.compiled($scope);
                $scope.$digest();

                expect(spy.args[0][0]).to.deep.equal({value: $scope.data.n2, options: { to: $scope.data.n3 } });
            });

            it('should merge options from less specific to more specific', function(){
                var spy = sinon.stub().returns(true);
                Provider.register('dummy', function(){
                    return spy;
                }, { valueFrom: '$viewValue' });

                var el = input('<input ng-model="data.n2" async-validator="{notdummy:\'dummy\'}" async-validator-options="{to: 1}" async-validator-options-notdummy="{to: 2}" async-validator-options-dummy="{to: 3}">');
                el.compiled($scope);
                $scope.$digest();

                expect(spy.args[0]).to.be.deep.equal([$scope.data.n2, { to: 3 }]);
            });

            it('should merge all available options', function(){
                var spy = sinon.stub().returns(true);
                Provider.register('dummy', function(){
                    return spy;
                }, { valueFrom: '$viewValue' });

                var el = input('<input ng-model="data.n2" async-validator="{notdummy:\'dummy\'}" async-validator-options="{one: 1}" async-validator-options-notdummy="{two: 2}" async-validator-options-dummy="{three: 3}">');
                el.compiled($scope);
                $scope.$digest();

                expect(spy.args[0]).to.be.deep.equal([$scope.data.n2, { one: 1, two: 2, three: 3 }]);
            });

            it('should merge all available options that applies', function(){
                var spy = sinon.stub().returns(true);
                Provider.register('dummy', function(){
                    return spy;
                }, { valueFrom: '$viewValue' });
                Provider.register('fine', function(){
                    return spy;
                }, { valueFrom: '$viewValue' });

                var el = input('<input ng-model="data.n2" async-validator="{notdummy:\'dummy\', ok: \'fine\'}" async-validator-options="{one: 1}" async-validator-options-nope="{two: 2}" async-validator-options-dummy="{three: 3}">');
                el.compiled($scope);
                $scope.$digest();

                expect(spy.args[0]).to.be.deep.equal([$scope.data.n2, { one: 1, three: 3 }]);
            });

            it('ignores non object options', function(){
                $scope['ok'] = sinon.stub().returns(true);

                var el = input('<input ng-model="data.n2" async-validator="\'ok($options)\'" async-validator-options="\'1\'" async-validator-options-validator="\'1\'">');
                el.compiled($scope);
                $scope.$digest();

                expect($scope['ok'].args[0]).to.be.deep.equal([{  }]);

                var el = input('<input ng-model="data.n2" async-validator="\'ok($options)\'" async-validator-options>');
                el.compiled($scope);
                $scope.$digest();

                expect($scope['ok'].args[0]).to.be.deep.equal([{  }]);
            });

            it('can use the same validator many times with different options', function(){
                var spy = sinon.spy();

                Provider.register('reuseValidator', function(){
                    return function($model, options) {
                        spy($model.$viewValue, options.mode);

                        switch (options.mode) {
                            case 'number':
                                return /^[0-9]+$/.test($model.$viewValue);
                            case 'object':
                                try {
                                    return angular.isObject(JSON.parse($model.$viewValue));
                                } catch (e) {
                                    return false;
                                }
                            case 'boolean':
                                return !!$model.$viewValue;
                        }
                        return true; // never fail the base validator
                    };
                });

                $scope['options'] = {
                    number: { mode: 'number' },
                    object: { mode: 'object' },
                    boolean: { mode: 'boolean' },
                };

                var el = input('<input ng-model="data.n6" async-validator-options-boolean="options.boolean" async-validator-options-object="options.object" async-validator-options-number="options.number" async-validator="{number: \'reuseValidator\', object: \'reuseValidator\', boolean: \'reuseValidator\'}">');
                el.compiled($scope);
                $scope.$digest();

                expect(spy.args[0]).to.deep.equal([$scope.data.n6, 'number']);
                expect(spy.args[1]).to.deep.equal([$scope.data.n6, 'object']);
                expect(spy.args[2]).to.deep.equal([$scope.data.n6, 'boolean']);

                expect(el.controller()).to.have.deep.property('$error.number', true);
                expect(el.controller()).to.not.have.deep.property('$error.boolean');
                expect(el.controller()).to.have.deep.property('$error.object', true);

                $scope.data.n6 = '{}';
                $scope.$digest();

                expect(el.controller()).to.have.deep.property('$error.number', true);
                expect(el.controller()).to.not.have.deep.property('$error.boolean');
                expect(el.controller()).to.not.have.deep.property('$error.object');

                $scope.data.n6 = '10';
                $scope.$digest();

                expect(el.controller()).to.not.have.deep.property('$error.number');
                expect(el.controller()).to.not.have.deep.property('$error.boolean');
                expect(el.controller()).to.have.deep.property('$error.object', true);
            });


        });
    });

});
