
// This is a shim that makes bind available in environments where it is not, in particular PhantomJS which we use for
// Continuous Integration on Jenkins.
// This shim is provided by cujojs/poly:
// https://github.com/cujojs/poly/blob/master/function.js
if (!Function.prototype.bind) {
    Function.prototype.bind = function bind(obj) {
        var args = Array.prototype.slice.call(arguments, 1),
            self = this,
            nop = function () {},
            bound = function () {
                return self.apply(this instanceof nop ? this : (obj || {}), args.concat(Array.prototype.slice.call(arguments)));
            };
        nop.prototype = this.prototype || {}; // Firefox cries sometimes if prototype is undefined
        bound.prototype = new nop();
        return bound;
    };
}
