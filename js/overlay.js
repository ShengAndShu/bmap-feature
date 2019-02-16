(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.CustomOverlay = factory();
    }
}(this, function () {

    var colors = [
        'rgba(230, 0, 18, 1)',
        'rgba(240, 170, 0, 1)',
        'rgba(0, 180, 0, 1)'
    ];

    function CustomOverlay(option) {
        this.option = option;
        this.points = [];
    }

    CustomOverlay.prototype = new BMap.Overlay();

    CustomOverlay.prototype.initialize = function (map) {
        var that = this,
            size = map.getSize();

        var canvas = this.canvas = document.createElement("canvas");
        var ctx = this.ctx = canvas.getContext("2d");
        canvas.style.cssText = "position:absolute;left:0;top:0;";
        canvas.width = size.width;
        canvas.height = size.height;

        that.map = map;

        // 添加canvas
        map.getPanes().labelPane.appendChild(canvas);

        // 清空
        that.points.length = 0;

        // 下面两个事件绑定，如果有jquery的话，请替换成$.porxy
        canvas.addEventListener('click', function(e){
            that._click(e);
        });

        canvas.addEventListener('mousemove', function (e) {
            that._mousemove(e); 
        });

        map.addEventListener('resize', that._resize);

        return canvas;
    };

    CustomOverlay.prototype.setPoints = function (data) {
        var project = this.map.getMapType().getProjection(),
            ctx = this.ctx,
            points = this.points;
        for (var i = 0, l = data.length; i < l; i++) {
            var lnglat = data[i].lnglat.split(',');
            var point = new BMap.Point(lnglat[1], lnglat[0]);
            var py = project.lngLatToPoint(point);
            points.push(new Marker(py.x, py.y, ctx, point, data[i]));
        }
        this.draw();
    };

    CustomOverlay.prototype.draw = function () {
        var map = this.map;
        var bounds = map.getBounds();
        var sw = bounds.getSouthWest();
        var ne = bounds.getNorthEast();
        var project = map.getMapType().getProjection();
        var pixel2 = project.lngLatToPoint(new BMap.Point(sw.lng, sw.lat));
        var pixel3 = project.lngLatToPoint(new BMap.Point(ne.lng, ne.lat));
        // pixel = map.pointToPixel(new BMap.Point(sw.lng, ne.lat));
        var size = map.getSize();
        var center = map.getCenter();
        var points = this.points;
        var length = points.length;

        if (center) {
            var pixel = map.pointToOverlayPixel(center);
            this.canvas.style.left = pixel.x - size.width / 2 + 'px';
            this.canvas.style.top = pixel.y - size.height / 2 + 'px';
        }

        // 墨卡托坐标计算方法
        var zoom = map.getZoom();
        var zoomUnit = Math.pow(2, 18 - zoom);
        var mcCenter = project.lngLatToPoint(map.getCenter());
        var nwMc = new BMap.Pixel(mcCenter.x - map.getSize().width / 2 * zoomUnit, mcCenter.y + map.getSize().height / 2 * zoomUnit);

        pixel2.x = (pixel2.x - nwMc.x) / zoomUnit;
        pixel2.y = (nwMc.y - pixel2.y) / zoomUnit;
        pixel3.x = (pixel3.x - nwMc.x) / zoomUnit;
        pixel3.y = (nwMc.y - pixel3.y) / zoomUnit;

        for (var i = 0; i < length; i++) {
            var c = points[i];
            if (c.pt && (!c.by || !c.bx)) {
                var pixel = project.lngLatToPoint(c.pt);
                c.bx = pixel.x;
                c.by = pixel.y;
            }
            if (c.bx && c.by) {
                c.x = (c.bx - nwMc.x) / zoomUnit;
                c.y = (nwMc.y - c.by) / zoomUnit;
                if (c.x == 0 && c.y == 0) {
                    var a;
                }
            }
        }

        this.canvas.style.opacity = 0.8;
        this.ctx.clearRect(0, 0, map.getSize().width, map.getSize().height);
        // this.ctx.globalCompositeOperation = "lighter";

        if (!length) return;

        for (var i = 0; i < length; i++) {
            var point = points[i];
            if (point.x == 0 && point.y == 0)
                continue;
            point.render();
        }
    };

    CustomOverlay.prototype._click = function (e) {
        var points = this.points;
        for (var i = points.length-1; i >= 0; i--) {
            var point = points[i];
            var x = e.clientX;
            var y = e.clientY;

            if (point.isVisible && Math.abs(point.x - x) < 7.5 && point.y - y < 18 && point.y - y > 2) {
                e.marker = point;
                this.option.click(e);
                return;
            }
        }
    };

    CustomOverlay.prototype._mousemove = function (e) {
        var points = this.points,
            canvas = this.canvas;
        for (var i = points.length-1; i >= 0; i--) {
            var point = points[i];
            var x = e.clientX;
            var y = e.clientY;

            if (point.isVisible && Math.abs(point.x - x) < 7.5 && point.y - y < 18 && point.y - y > 2) {
                canvas.style.cursor = 'pointer';
                return;
            }
        }
        if (canvas.style.cursor)
            canvas.style.cursor = '';
     };

    CustomOverlay.prototype._resize = function () {
        var size = this.map.getSize();
        var pixelRatio = getPixelRatio(this.ctx);
        this.canvas.width = size.width * pixelRatio;
        this.canvas.height = size.height * pixelRatio;
        this.canvas.style.width = size.width + 'px';
        this.canvas.style.height = size.height + 'px';
        this.draw();
    };

    function Marker(x, y, ctx, pt, data) {
        this.bx = this.x = x;
        this.by = this.y = y;
        this.point = pt;
        this.ctx = ctx;
        this.data = data;

        this.render = function () {
            var that = this,
                ctx = that.ctx,
                x = that.x,
                y = that.y;

            that.isVisible = false;

            if (x < 0 || y < 0)
                return false;
            if (x > ctx.canvas.width || y > ctx.canvas.height)
                return false;

            ctx.beginPath();
            ctx.fillStyle = getColor(that.data.mos) || 'rgba(230, 0, 18, 1)';
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x - 7.5, y - 8, x - 7.5, y - 12);
            ctx.arc(x, y - 12, 7.5, Math.PI * 1, 0);
            ctx.quadraticCurveTo(x + 7.5, y - 8, x, y);
            ctx.fill();

            that.isVisible = true;
            return true;
        }
    }

    function getPixelRatio(context) {
        var backingStore = context.backingStorePixelRatio ||
            context.webkitBackingStorePixelRatio ||
            context.mozBackingStorePixelRatio ||
            context.msBackingStorePixelRatio ||
            context.oBackingStorePixelRatio ||
            context.backingStorePixelRatio || 1;
        var devicePixelRatio = window.devicePixelRatio || 1;

        return devicePixelRatio / backingStore;
    }

    function getColor(mos) {
        mos = parseFloat(mos);
        if (mos > 4.2) {
            return colors[0];
        } else if (mos > 3.6) {
            return colors[1];
        } else {
            return colors[2];
        }
    }

    return CustomOverlay;
}));