describe('3ss', function() {
    'use strict';

    var StyleRule, StyleRuleList, StyledObject, StyleMaterialCache;
    var styleContext, context;

    beforeEach(function() {
        styleContext = new window.ThreeSS.StyleContext();

        StyleRule          = window.ThreeSS.StyleRule;
        StyleRuleList      = window.ThreeSS.StyleRuleList;
        StyledObject       = window.ThreeSS.StyledObject;
        StyleMaterialCache = window.ThreeSS.StyleMaterialCache;
    });

    describe("StyleContext", function() {
        it ("should add rules to the rule list when they are declared", function() {
            styleContext.ruleList = jasmine.createSpyObj('ruleList', ['addRule']);

            var expectedRule = new StyleRule('line.cool', {foo: 'bar'});
            styleContext.ruleList.addRule.andReturn(expectedRule);
            styleContext.declareRule('line.cool', { foo: 'bar' });
            expect(styleContext.ruleList.addRule).toHaveBeenCalledWith(expectedRule);
        });

        it ("should declare a styled object, with a filled in material", function() {
            styleContext.declareRule('line', { material: "lineBasic" });
            var obj = styleContext.declareObject('line', "foo bar", { front: 'black' });
            expect(obj.getMaterial()).not.toBe(null);
            expect(obj.getMaterial() instanceof THREE.LineBasicMaterial).toBe(true);
        });

        it ("should add derived objects to the objects list", function() {
            styleContext.declareRule('line', { material: "lineBasic" });
            var obj = styleContext.declareObject('line', "foo bar", { front: 'black' });
            expect(styleContext.objects).toEqual([obj]);

            var obj2 = obj.createDerivedObject('subclass', { foo: 'bar' });
            expect(styleContext.objects).toEqual([obj, obj2]);
        });

        it ("should destroy its material cache and objects when the context is destroyed", function() {
            styleContext.declareRule('line', { material: "lineBasic" });
            var obj = styleContext.declareObject('line', "foo bar", { front: 'black' });

            spyOn(obj, 'destroy');
            spyOn(styleContext.materialCache, 'destroy');

            styleContext.destroy();
            expect(obj.destroy).toHaveBeenCalled();
            expect(styleContext.materialCache.destroy).toHaveBeenCalled();
        });
    });

    describe("StyleRuleList", function() {
        var ruleList;

        beforeEach(function() {
            ruleList = new StyleRuleList();
        });


        it ("should move to a dirty state when declaring a new rule", function() {
            expect(ruleList.ruleAdded).toBe(false);
            ruleList.addRule(new StyleRule('line', 'cool'));
            expect(ruleList.ruleAdded).toBe(true);
        });

        it ("should invoke the ruleAddedListeners when rules are added", function() {
            var rule1 = new StyleRule('line', 'cool'),
                rule2 = new StyleRule('line2', 'cool2');

            var listener1 = jasmine.createSpy(),
                listener2 = jasmine.createSpy();

            ruleList.addRuleAddedListener(listener1);
            ruleList.addRuleAddedListener(listener2);

            ruleList.addRule(rule1);
            ruleList.addRule(rule2);

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();

            ruleList.processDirtyRules();

            expect(listener1).toHaveBeenCalledWith([rule1, rule2]);
            expect(listener2).toHaveBeenCalledWith([rule1, rule2]);
        });

        it ("should not invoke ruleAddedListeners if the rule list is not dirty", function() {
            var rule1 = new StyleRule('line', 'cool');
            var listener = jasmine.createSpy();

            ruleList.addRuleAddedListener(listener);
            ruleList.addRule(rule1);

            ruleList.processDirtyRules();
            expect(listener).toHaveBeenCalled();

            listener.reset();
            ruleList.processDirtyRules();
            expect(listener).not.toHaveBeenCalled();
        });


        it ("should iterate over rules in order of specificity", function() {
            var lineCool    = new StyleRule('line.cool', { foo: 'black' }),
                cool        = new StyleRule('.cool', { foo: 'red' }),
                lineCoolFat = new StyleRule('line.cool.fat', { foo: 'green' });

            ruleList.addRule(lineCool);
            ruleList.addRule(cool);
            ruleList.addRule(lineCoolFat);

            var rules = [];
            ruleList.eachRule(function(rule) {
                this.push(rule);
            }, rules);

            expect(rules).toEqual([cool, lineCool, lineCoolFat]);
        });
    });

    describe("StyleRule", function() {
        it ("should calculate specificity on creation", function() {
            expect(new StyleRule('line').specificity).toBe(1);
            expect(new StyleRule('line.foo').specificity).toBe(11);
        });

        it ("should calculate specificity", function() {
            var rule = new StyleRule('line', {});
            expect(rule.calculateSpecificity('line')).toBe(1);
            expect(rule.calculateSpecificity('line foo')).toBe(2);
            expect(rule.calculateSpecificity('line.foo')).toBe(11);
            expect(rule.calculateSpecificity('line.foo bar')).toBe(12);
            expect(rule.calculateSpecificity('line.foo bar.baz')).toBe(22);
            expect(rule.calculateSpecificity('.foo.baz')).toBe(20);
            expect(rule.calculateSpecificity('.foo')).toBe(10);
            expect(rule.calculateSpecificity('#obj.foo')).toBe(110);
            expect(rule.calculateSpecificity('#obj')).toBe(100);
            expect(rule.calculateSpecificity('line #obj.foo')).toBe(111);
        });

        it ("should match DOM elements that have the appropriate class & name", function() {
            var d1 = document.createElement('div');
            d1.className = 'cool dude';

            expect(new StyleRule('div', {}).matches(d1)).toBe(true);
            expect(new StyleRule('div.cool', {}).matches(d1)).toBe(true);
            expect(new StyleRule('div.cool.dude', {}).matches(d1)).toBe(true);
            expect(new StyleRule('div.dude', {}).matches(d1)).toBe(true);
            expect(new StyleRule('foo', {}).matches(d1)).toBe(false);
            expect(new StyleRule('foo.dude', {}).matches(d1)).toBe(false);
        });

        it ("should invoke listeners when the style is updated", function() {
            var rule     = new StyleRule('div', {foo: 'bar'}),
                listener = jasmine.createSpy();

            rule.addUpdateListener(listener);
            rule.updateStyle({bar: 'baz'});
            expect(listener).toHaveBeenCalled();
        });
    });

    describe("StyledObject", function() {
        var styledObj, coolRule;

        beforeEach(function() {
            coolRule  = styleContext.declareRule('.cool', { material: 'lineBasic', shade: 'blue' });
            styledObj = styleContext.declareObject('div', 'cool dude', { myStyle: true });
        });

        it ("should compute its style and material on construction", function() {
            expect(styledObj.computedStyle).toEqual({
                material: 'lineBasic',
                shade: 'blue',
                myStyle: true
            });

            expect(styledObj.material instanceof THREE.LineBasicMaterial).toBe(true);
        });

        it ("should recompute its style if a rule is added which matches", function() {
            styleContext.declareRule('.dude', { barfo: 'true' });
            styleContext.process();
            expect(styledObj.computedStyle).toEqual({
                material: 'lineBasic',
                shade: 'blue',
                myStyle: true,
                barfo: 'true'
            });
        });

        it ("should not recompute its style if a rule is added which does not match", function() {
            styleContext.process();
            styleContext.declareRule('.noway', { barfo: 'true' });
            spyOn(styledObj, "computeStyleAndApply");
            expect(styledObj.computeStyleAndApply).not.toHaveBeenCalled();
        });

        it ("should recompute its style if a rule is changed", function() {
            spyOn(styledObj, "computeStyleAndApply");
            coolRule.updateStyle({ goof: 'ball' });
            expect(styledObj.computeStyleAndApply).toHaveBeenCalled();
        });

        it ("should trigger a materialChange callback in LIFO order when a material changes",
            function()
        {
            var listener1 = jasmine.createSpy(),
                listener2 = jasmine.createSpy();

            var calls = [];
            listener1.andCallFake(function() {
                calls.push('listener1');
            });

            listener2.andCallFake(function() {
                calls.push('listener2');
            });

            styledObj.addMaterialChangeListener(listener1);
            styledObj.addMaterialChangeListener(listener2);

            styledObj.setMaterial({linewidth: 20, material: 'lineBasic' });

            expect(styledObj.getMaterial().linewidth).toEqual(20);
            expect(styledObj.getMaterial() instanceof THREE.LineBasicMaterial);
            expect(styledObj.getComputedStyle()).toEqual({linewidth: 20, material: 'lineBasic'});

            expect(calls).toEqual(['listener2', 'listener1']);
        });

        it ("should not trigger a materialChange callback if material doesnt change", function() {
            styledObj.setMaterial({linewidth: 20, material: 'lineBasic' });
            var listener = jasmine.createSpy();
            styledObj.addMaterialChangeListener(listener);
            styledObj.setMaterial({linewidth: 20, material: 'lineBasic' });
            expect(listener).not.toHaveBeenCalled();
        });

        it ("should apply material changes to targets", function() {
            var target = { material: 'foo' };
            styledObj.applyMaterialOnChange(target);
            expect(target.material).not.toEqual('foo');

            coolRule.updateStyle({ doo: 'dad' });
            expect(target.material instanceof THREE.Material).toBe(true);
            expect(target.material).toBe(styledObj.getMaterial());
        });

        it ("should create derived objects which are destroyed with the context", function() {
            styleContext.declareRule('.mystyle', { material: 'lineBasic' });
            var subObj = styledObj.createDerivedObject('mystyle', { snog: 'blar' });
            spyOn(subObj, 'destroy');
            styleContext.destroy();
            expect(subObj.destroy).toHaveBeenCalled();
        });

        it ("should create derived objects", function() {
            styleContext.declareRule('.mystyle', { material: 'lineBasic' });
            var subObj = styledObj.createDerivedObject('mystyle', { snog: 'blar', linewidth: 20 });
            expect(subObj.getMaterial().linewidth).toEqual(20);
            expect(subObj.getMaterial() instanceof THREE.LineBasicMaterial).toBe(true);
            expect(subObj.getComputedStyle()).toEqual({
                material: 'lineBasic',
                snog: 'blar',
                linewidth: 20
            });
        });

        it ("should return the class string", function() {
            expect(styledObj.getClassStr()).toEqual('cool dude');
            styledObj.addClass('barfo');
            expect(styledObj.getClassStr()).toEqual('cool dude barfo');
            styledObj.removeClass('dude');
            expect(styledObj.getClassStr()).toEqual('cool barfo');
        });

        it ("should trigger a style recomputation if classes are added", function() {
            spyOn(styledObj, 'computeStyleAndApply');
            styledObj.addClass('foo');
            expect(styledObj.computeStyleAndApply).toHaveBeenCalled();
        });

        it ("should trigger a style recomputation if classes are removed", function() {
            spyOn(styledObj, 'computeStyleAndApply');
            styledObj.removeClass('foo');
            expect(styledObj.computeStyleAndApply).toHaveBeenCalled();
        });

        it ("should add and remove classes from the associated DOMelement", function() {
            var classList = styledObj.domElement.classList;
            styledObj.addClass('foo');
            expect(classList.contains('foo')).toBe(true);
            expect(classList.contains('dude')).toBe(true);
            styledObj.removeClass('dude');
            expect(classList.contains('dude')).toBe(false);
        });

        it ("should remove the associated domElement when destroy is called", function() {
            styledObj.destroy();
            expect(styledObj.domElement).toEqual(null);
        });

        it ("should update its usingRules and listeners during style computation", function() {
            expect(styledObj.usingRules).toEqual([coolRule]);
            expect(coolRule.updateListeners.length).toBe(1);

            styledObj.computeStyleAndApply();
            expect(styledObj.usingRules).toEqual([coolRule]);

            var dudeRule = styleContext.declareRule('.dude', { far: 'back' });
            styleContext.process();
            expect(styledObj.usingRules).toEqual([coolRule, dudeRule]);
            expect(dudeRule.updateListeners.length).toBe(1);
        });

        it ("should compute style and matching rules", function() {
            var lineRule = styleContext.declareRule('line', { material: 'lineBasic' });
            var fooRule = styleContext.declareRule('.foo', { wasFoo: true });
            var bazRule = styleContext.declareRule('.baz', { wasBaz: true });
            var fooBarRule = styleContext.declareRule('.foo.bar', { wasFooAndBar: true });

            var obj = styleContext.declareObject('line', "foo bar", { localStyle: '3'}),
                styleComputation = obj.computeStyle();

            expect(styleComputation.rules).toEqual([lineRule, fooRule, fooBarRule]);

            expect(styleComputation.computedStyle).toEqual({
                material:     'lineBasic',
                wasFoo:       true,
                wasFooAndBar: true,
                localStyle:   '3'
            });
        });
    });

    describe("StyleMaterialCache", function() {
        var cache;

        beforeEach(function() {
            cache = new StyleMaterialCache();
        });

        it ("should cache materials", function() {
            var mat1 = cache.getMaterial({ material: 'lineBasic', color: 0xff00ff }),
                mat2 = cache.getMaterial({ material: 'lineBasic', color: 0x00ff00 });

            expect(cache.getMaterial({ material: 'lineBasic', color: 0xff00ff})).toBe(mat1);
            expect(cache.getMaterial({ material: 'lineBasic', color: 0x00ff00})).toBe(mat2);
        });

        it ("should create cache keys based on the style", function() {
            expect(cache.makeCacheKey({ z: 1, b: 2, d: 3, a: 4 })).toEqual('a=4 b=2 d=3 z=1');
            expect(cache.makeCacheKey({})).toEqual('');
        });

        it ("should create materials from a style", function() {
            var mat1 = cache.getMaterial({
                material: 'lineBasic',
                color: 0xff00ff,
                opacity: 0.7
            });
            expect(mat1.material).toBe(undefined);
            expect(mat1 instanceof THREE.LineBasicMaterial).toBe(true);
            expect(mat1.color.getHex()).toEqual(0xff00ff);
            expect(mat1.opacity).toEqual(0.7);

            expect(mat1._style).toEqual({
                color: 0xff00ff,
                opacity: 0.7
            });
        });

        it ("should create materials from a style 2", function() {
            var mat1 = cache.getMaterial({
                material: 'meshNormal',
                opacity: 0.6
            });
            expect(mat1.material).toBe(undefined);
            expect(mat1 instanceof THREE.MeshNormalMaterial).toBe(true);
            expect(mat1.opacity).toEqual(0.6);
        });
    });

    describe("Integration", function() {
        it ("should re-style all objects when a common rule has changed", function() {
            var rule = styleContext.declareRule('div', { material: 'lineBasic' });
            styleContext.process();

            var obj1 = styleContext.declareObject('div', {}),
                obj2 = styleContext.declareObject('div', {});

            expect(obj1.getMaterial() instanceof THREE.LineDashedMaterial).toBe(false);
            expect(obj2.getMaterial() instanceof THREE.LineDashedMaterial).toBe(false);
            rule.updateStyle( { material: 'lineDashed' });
            expect(obj1.getMaterial() instanceof THREE.LineDashedMaterial).toBe(true);
            expect(obj2.getMaterial() instanceof THREE.LineDashedMaterial).toBe(true);
        });
    });
});
