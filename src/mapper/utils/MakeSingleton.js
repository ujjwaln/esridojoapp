define(["dojo/_base/lang"], function(lang) {
    return function(ctor) {
        var singletonCtor,
            instance = null;
            
        singletonCtor = new function() {
            this.getInstance = function() {
                if (!instance) {
                    instance = new ctor(this.arguments ||null);
                    instance.constructor = null;
                }
                return instance;
            };
        };
        
        if (ctor.prototype && ctor.prototype.declaredClass) {
            lang.setObject(ctor.prototype.declaredClass, singletonCtor);
        }
        
        return singletonCtor;
    };
});
