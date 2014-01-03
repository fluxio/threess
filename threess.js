/*
 * Copyright 2013 the original author or authors
 * @license MIT, see LICENSE.txt for details
 *
 * @author Jon Travis
 */

(function(exports, document) {
    'use strict';

    /**
     * The {StyleContext} holds onto {StyleRule}s and {StyledObject}s and acts as the primary
     * point of contact for interactions from the outside world.
     *
     * @constructor
     */
    function StyleContext() {
        this.objects       = [];
        this.ruleList      = new StyleRuleList();
        this.materialCache = new StyleMaterialCache();
    }

    /**
     * Bring the hierarchy of style up-to-date with any changes.  When adding rules, objects
     * may become out-of-date with the new rules, thus a process cycle must be invoked to
     * bring them up-to-date.
     */
    StyleContext.prototype.process = function() {
        this.ruleList.processDirtyRules();
    };

    /**
     * Declare a style rule, based on abridged CSS selector / styling.  Rules are applied
     * to objects in CSS specificity (i.e. 'line.foo' is more specific than 'line').
     *
     * Selector elements correspond to the 'type' of object being drawn (i.e. line, mesh, etc.)
     *
     * @param {String}  selector  Selector text  (e.g. '.parcel' or 'line.parcel')
     * @param {Object}  style     Style to associate with items matching the given selector.
     *                            Each key-value pair is copied into the target material verbatim,
     *                            as defined by each {THREE.Material} type.  A special 'material'
     *                            key is used within the style to define the {THREE.Material}
     *                            to instantiate (e.g. material='lineBasic') will instantiate a
     *                            {THREE.LineBasicMaterial}
     * @return {StyleRule} the declared rule
     */
    StyleContext.prototype.declareRule = function(selector, style) {
        var rule = new StyleRule(selector, style);
        this.ruleList.addRule(rule);
        return rule;
    };

    /**
     * Declare an object which can be styled.  Declaring an object in this fashion registers
     * it with the {StyleContext} which will execute the callback function with any updates
     * to its material.
     *
     * @param {String}    objectType  Type of the object ('line', 'mesh', etc.)  This
     *                                object type can be used in a way similar to an
     *                                HTML tag (aka element name).
     * @param {String}    classStr    A space-separated string of classes to assign to this
     *                                object.  (e.g. "parcel skinny")   This argument is
     *                                equivalent to the HTML 'class=' attribute.
     * @param {Object}    [style]     An optional object with key-value pairs containing the
     *                                attributes to apply to the associated {THREE.Material}.
     *                                This argument is equivalent to the HTML 'style='
     *                                attribute.
     * @returns {StyledObject}
     *
     * @see {StyleContext#declareRule}
     */
    StyleContext.prototype.declareObject = function(objectType, classStr, style) {
        style = style || {};
        var me = this;
        var onDerived = function(derivedObject) {
            me.objects.push(derivedObject);
        };

        var styledObject = new StyledObject(objectType, classStr, style, this.ruleList,
                                            this.materialCache, onDerived);

        this.objects.push(styledObject);
        return styledObject;
    };

    /**
     * Destroy this context, cleaning up all associated resources.
     */
    StyleContext.prototype.destroy = function() {
        this.materialCache.destroy();
        this.objects.forEach(function(styledObject) {
            styledObject.destroy();
        });
    };

    /**
     * A {StyleRuleList} is a wrapper around a list of {StyleRule}s.
     * @constructor
     */
    function StyleRuleList() {
        this.rules =              [];
        this.ruleAddedListeners = [];
        this.rulesAdded =         [];
        this.ruleAdded =          false;
    }

    /**
     * Add a {StyleRule} to the list.  Adding a rule to the list will mark this rule list
     * as dirty, and all listeners will be notified upon the next style processing.
     *
     * @param {StyleRule} rule  Rule to add
     */
    StyleRuleList.prototype.addRule = function(rule) {
        this.rules.push(rule);
        this.rules.sort(function(a, b) {
            return a.specificity - b.specificity;
        });

        this.rulesAdded.push(rule);
        this.ruleAdded = true;
    };

    /**
     * Add a listener which is invoked any time a new {StyleRule} is added to this list.
     *
     * @param {Function}  listener  Function taking {StyleRule[]} containing the rules which
     *                              were added.
     */
    StyleRuleList.prototype.addRuleAddedListener = function(listener) {
        this.ruleAddedListeners.push(listener);
    };

    function shallowClone(obj) {
        var res = {}, i;
        for (i in obj) {
            if (obj.hasOwnProperty(i)) {
                res[i] = obj[i];
            }
        }
        return res;
    }

    /**
     * Process all the ruleAddedListeners, notifying them of all the rules which have been
     * added.
     */
    StyleRuleList.prototype.processDirtyRules = function() {
        if (!this.ruleAdded) {
            return;
        }

        this.ruleAddedListeners.forEach(function(listener) {
            listener(this.rulesAdded.slice(0));
        }, this);

        this.rulesAdded.length = 0;
        this.ruleAdded = false;
    };

    /**
     * Iterate over the rules in specificity-ascending order, executing the callback for each.
     *
     * @param {Function}   callback   Function to execute for each rule (taking a {StyleRule})
     * @param {Object}     context    'this' for each callback
     */
    StyleRuleList.prototype.eachRule = function(callback, context) {
        var cback = callback.bind(context);
        this.rules.forEach(function(rule) {
            cback(rule);
        });
    };

    /**
     * A {StyleRule} is the combination of a CSS selector and its associated style.  It is used
     * to match against {StyledObject}s and apply styles to them.
     *
     * @param {String}   selector   A CSS selector
     * @param {Object}   style      A key-value map of attributes applicable to a {THREE.Material}
     *
     * @constructor
     * @private
     * @see StyleContext#declareRule
     */
    function StyleRule(selector, style) {
        this.selector    = selector;
        this.style       = style;
        this.updateListeners = [];
        this.specificity = this.calculateSpecificity(selector);
    }

    /**
     * Calculate the CSS specificity of the given selector.
     *
     * @param {String}   selector   CSS selector to get specificity of
     * @returns {Number}  the specificity -- higher numbers being more specific
     * @see http://www.w3.org/TR/css3-selectors/#specificity
     * @private
     */
    StyleRule.prototype.calculateSpecificity = function(selector) {
        var parsed = Slick.parse(selector);
        if (parsed.expressions.length !== 1) {
            throw new Error("We are only calculating selectors with no ',' in them");
        }

        var expression = parsed.expressions[0];
        var idCount    = 0,
            classCount = 0,
            tagCount   = 0;

        expression.forEach(function(elem) {
            if (elem.id) {
                idCount += 1;
            }

            if (elem.tag !== '*') {
                tagCount += 1;
            }

            if (elem.classes) {
                classCount += elem.classes.length;
            }
        });

        return idCount * 100 + classCount * 10 + tagCount;
    };

    /**
     * Returns true if the passed DOM element is matched by the selector within this rule.
     *
     * @param {HTMLElement}  domElement   Element to match
     * @returns {Boolean}  true if this rule matches the passed element
     */
    StyleRule.prototype.matches = function(domElement) {
        return Slick.match(domElement, this.selector);
    };

    /**
     * Add a listener to be invoked when this rule's style has been updated.  Listeners are
     * invoked as soon as an update has occurred (i.e. it does not wait for an angular digestion)
     *
     * @param {Function} listener   Listener which is invoked when this rule's style is updated.
     */
    StyleRule.prototype.addUpdateListener = function(listener) {
        this.updateListeners.push(listener);
    };

    /**
     * Update the style of this rule.  Listeners will be invoked immediately after updating the
     * internal style.
     *
     * @param {Object} styleUpdate  Updates to the style.  Note that this method only updates or
     *                              adds style to this rule.  It does not entirely replace the
     *                              internal style, nor does it remove any style attributes.
     */
    StyleRule.prototype.updateStyle = function(styleUpdate) {
        extend(this.style, styleUpdate);
        this.updateListeners.forEach(function(listener) {
            listener();
        });
    };

    function extend(target, extend) {
        var i;
        for (i in extend) {
            if (extend.hasOwnProperty(i)) {
                target[i] = extend[i];
            }
        }
    }

    /**
     * A {StyledObject} provides an abstraction around styling for a {THREE.Object}.  It stores
     * 'class' and 'style' information and uses it to compute style in a way similar to HTML + CSS.
     *
     * This class is able to recompute its style and notify listeners.  Style computation can
     * occur for a number of reasons:
     *   - Classes are added / removed
     *   - Rules are added to the associated {StyleRuleList}
     *   - A {StyleRule} which matches this object has had its style modified
     *
     *
     * @param {String}             objectType      'Type' of the object (e.g. 'line', 'mesh', etc.)
     * @param {String}             classStr        Space separated list of classes ("skinny blue")
     * @param {Object}             style           A key-value map of attributes to always apply to
     *                                             the {THREE.Material} associated with this object
     * @param {StyleRuleList}      ruleList        Rule list housing rules which dictate the style
     * @param {StyleMaterialCache} materialCache   Cache to use for storing / retrieving materials
     * @param {Function}           onDerive        Callback to invoke when this object is derived.
     *                                             Callback is invoked with the derived {StyledObject}
     * @constructor
     * @private
     */
    function StyledObject(objectType, classStr, style, ruleList, materialCache, onDerive) {
        this.objectType       = objectType;
        this.style            = style;
        this.ruleList         = ruleList;
        this.materialCache    = materialCache;
        this.onDerive         = onDerive;

        this.domElement = document.createElement(objectType);
        this.domElement.className = classStr;

        this.materialChangeListeners = [];
        this.material         = null;
        this.usingRules       = [];
        this.computedStyle    = null;

        this.computeStyleAndApply();

        var me = this;
        this.ruleList.addRuleAddedListener(function(addedRules) { me.onRuleAdded(addedRules); });
    }

    /**
     * Called when a new rule has been added to the associated {StyleRuleList}.  If any of
     * the added rules match this object, then this object's style will be recomputed.
     *
     * @param {StyleRule[]} addedRules  New rules which have been added
     * @private
     */
    StyledObject.prototype.onRuleAdded = function(addedRules) {
        for (var i=0; i<addedRules.length; i++) {
            if (addedRules[i].matches(this.domElement)) {
                this.computeStyleAndApply();
                return;
            }
        }
    };

    /**
     * Called when a {StyleRule} which has previously matched this object has changed
     * its style.
     * @private
     */
    StyledObject.prototype.onRuleChanged = function() {
        this.computeStyleAndApply();
    };

    /**
     * Add a listener to be called when this object's material has changed.  Note that listeners
     * are called in LIFO order:  listeners added last will be called first.
     *
     * @param {Function}  listener  Listener to call on material change.  The listener will
     *                              be invoked as:  listener( {THREE.Material}, {Object} )
     *                              where the second object is the new computed style associated
     *                              with the material.
     */
    StyledObject.prototype.addMaterialChangeListener = function(listener) {
        this.materialChangeListeners.unshift(listener);
    };

    /**
     * Utility method to set a target's .material when this object's material has changed.  This
     * method forcefully applies a new material to the target on invocation.
     *
     * @param {Object}   target   Target which should have its .material assigned with a new
     *                            {THREE.Material} when this object's style has changed.
     */
    StyledObject.prototype.applyMaterialOnChange = function(target) {
        target.material = this.material;
        this.addMaterialChangeListener(function(material) {
            target.material = material;
        });
    };


    /**
     * Create a derived {StyledObject}, based on this one.  A derived object is useful in
     * scenarios where this object is used as a template and many derived styles must
     * be created.
     *
     * The resulting {StyledObject} has the same objectType as this object and participates
     * in the same cleanup, but otherwise shares no data with this object.

     * @param {String} classStr   Classes that the derived object has: ('cool dude')
     * @param {Object} style      Style that the derived object has: ({ width: 20 })
     * @returns {StyledObject} a derived style object
     */
    StyledObject.prototype.createDerivedObject = function(classStr, style) {
        var derived = new StyledObject(this.objectType, classStr, style, this.ruleList,
                                       this.materialCache, this.onDerive);

        this.onDerive(derived);
        return derived;
    };

    /**
     * Returns the class string associated with the object.
     * @returns {String}  the class string ('cool dude')
     */
    StyledObject.prototype.getClassStr = function() {
        return this.domElement.className;
    };

    /**
     * Returns the style associated with the object.
     * @returns {Object}  the style ({ linewidth: 20 })
     */
    StyledObject.prototype.getStyle = function() {
        return this.style;
    };

    /**
     * Returns the computed style of the object.  The computed style is the result of applying
     * all matching rules, plus this objects .style.
     * @returns {Object}  the computed style
     */
    StyledObject.prototype.getComputedStyle = function() {
        return this.computedStyle;
    };

    /**
     * Set the material for the styled object.  If the passed material is different than the
     * one currently set, the 'materialChangeListeners' function will be executed with the new material.
     *
     * @param {Object} computedStyle  The computed style for which to set the material
     * @private
     */
    StyledObject.prototype.setMaterial = function(computedStyle) {
        var material = this.materialCache.getMaterial(computedStyle);

        if (this.material !== material) {
            this.computedStyle = computedStyle;
            this.material = material;
            this.materialChangeListeners.forEach(function(listener) {
                listener(material, this.computedStyle);
            }, this);
        }
    };

    /**
     * Returns the last computed material for this object.
     * @returns {THREE.Material} the last computed material.
     */
    StyledObject.prototype.getMaterial = function() {
        return this.material;
    };

    /**
     * Add a CSS class to this object's class list.
     *
     * @param {String} clazz   A single class name to add
     * @returns {StyledObject} this
     */
    StyledObject.prototype.addClass = function(clazz) {
        this.domElement.classList.add(clazz);
        this.computeStyleAndApply();
        return this;
    };

    /**
     * Remove a CSS class from this object's class list.
     *
     * @param {String} clazz A single class name to remove (e.g. "large")
     * @returns {StyledObject} this
     */
    StyledObject.prototype.removeClass = function(clazz) {
        this.domElement.classList.remove(clazz);
        this.computeStyleAndApply();
        return this;
    };

    /**
     * Destroy the internals associated with this object.
     * @private
     */
    StyledObject.prototype.destroy = function() {
        if (this.domElement.parentNode) {
            this.domElement.parentNode.removeChild(this.domElement);
        }
        this.domElement = null;
    };

    /**
     * Compute this object's style, setting its associated material.
     *
     * {StyleRule}s from the {StyleRuleList} which match this object will be added to a list
     * of 'usingRules' which contains the list of rules which this object is using or has
     * used.  This object will listen for changes to any of the 'usingRules', which will
     * subsequently trigger style re-computation.
     *
     * @private
     */
    StyledObject.prototype.computeStyleAndApply = function() {
        var styleComputation = this.computeStyle();
        this.setMaterial(styleComputation.computedStyle);

        var onRuleChange = this.onRuleChanged.bind(this);
        styleComputation.rules.forEach(function(rule) {
            if (this.usingRules.indexOf(rule) === -1) {
                this.usingRules.push(rule);
                rule.addUpdateListener(onRuleChange);
            }
        }, this);
    };

    /**
     * Returns the computed style of a given {StyledObject}.  This routine will iterate through
     * all the declared {StyleRule}s (in order of CSS specificity), composing the ultimate
     * style for the object.  The object's matched rules and explicit style are both used
     * to compute the final style.
     *
     * @returns {{rules: StyleRule[], computedStyle: Object}}  the rules which were matched
     *   and factored into the final computation.
     *
     * @see {StyleContext#declareRule}
     * @private
     */
    StyledObject.prototype.computeStyle = function() {
        var style = {};
        var matchedRules = [];
        this.ruleList.eachRule(function(rule) {
            if (rule.matches(this.domElement)) {
                matchedRules.push(rule);
                extend(style, rule.style);
            }
        }, this);

        extend(style, this.style);

        return {
            rules:         matchedRules,
            computedStyle: style
        };
    };

    /**
     * The {StyleMaterialCache} is a simple cache which maps styles onto their associated
     * {THREE.Material}s.  This object also acts as a factory, creating materials to fill the
     * cache as they are requested.
     *
     * @constructor
     */
    function StyleMaterialCache() {
        this.styleMaterials = {};
    }

    /**
     * Destroy this cache and dispose of all referenced materials.
     * @private
     */
    StyleMaterialCache.prototype.destroy = function() {
        /*
         TODO:  We currently cannot dispose of Materials due to THREE.js holding onto
         references somewhere.  MrDoob needs fiddle

        _.each(this.styleMaterials, function(material) {
            material.dispose();
        });
        */
        this.styleMaterials = null;
    };

    /**
     * Get the {THREE.Material} for a given style.
     *
     * @param {Object} style  Key-value attributes which describe the style of material
     * @returns {THREE.Material} specified byt he style
     * @private
     */
    StyleMaterialCache.prototype.getMaterial = function(style) {
        if (!this.styleMaterials) {
            throw new Error("Attempted to use a material which has already been destroyed");
        }

        var cacheKey = this.makeCacheKey(style),
            material = this.styleMaterials[cacheKey];

        if (material) {
            return material;
        }

        material = this.createMaterial(style);
        this.styleMaterials[cacheKey] = material;
        return material;
    };

    /**
     * Create a cache-key suitable for caching the given style.  This method simply returns
     * a string of style's key-value pairs, sorted by the keys
     *
     * @param {Object} style  Style to make the cache key for
     * @returns {String}  A string which represents the entire style
     * @private
     */
    StyleMaterialCache.prototype.makeCacheKey = function(style) {
        var i,
            keys = Object.keys(style),
            components = [];

        keys.sort(function(a, b) {
            return a.localeCompare(b);
        });

        for (i=0; i<keys.length; i++) {
            components.push(keys[i] + "=" + style[keys[i]]);
        }

        return components.join(" ");
    };

    /**
     * Create a {THREE.Material} for the given style
     *
     * @param {Object} style  Key-value pairs of attributes to apply to the result {THREE.Material}.
     *                        This style also contains a magical attribute (.material) which
     *                        indicates the class to use when instantiating the material.
     *                        (e.g. material = 'lineBasic', material = 'meshNormal')
     * @return {THREE.Material}  a newly created material, configured by the given style
     * @private
     */
    StyleMaterialCache.prototype.createMaterial = function(style) {
        var styleClone = shallowClone(style);
        if (!styleClone.material) {
            console.warn("Style has no .material", style);
            throw new Error("Style has no .material");
        }

        var materialClassName = styleClone.material[0].toUpperCase() +
                                styleClone.material.substr(1) + "Material",
            material = new THREE[materialClassName]();

        delete styleClone.material;
        material.setValues(styleClone);
        return material;
    };

    exports.ThreeSS = {
        StyleContext:       StyleContext,
        StyleRule:          StyleRule,
        StyleRuleList:      StyleRuleList,
        StyleMaterialCache: StyleMaterialCache
    };
}(window, document));
