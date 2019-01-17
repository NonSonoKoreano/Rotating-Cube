/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / https://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finter swipe

THREE.OrbitControls = function(object, domElement) {

  this.object = object;

  this.domElement = (domElement !== undefined) ? domElement : document;

  // Set to false to disable this control
  this.enabled = true;

  // "target" sets the location of focus, where the object orbits around
  this.target = new THREE.Vector3();

  // How far you can dolly in and out ( PerspectiveCamera only )
  this.minDistance = 0;
  this.maxDistance = Infinity;

  // How far you can zoom in and out ( OrthographicCamera only )
  this.minZoom = 0;
  this.maxZoom = Infinity;

  // How far you can orbit vertically, upper and lower limits.
  // Range is 0 to Math.PI radians.
  this.minPolarAngle = 0; // radians
  this.maxPolarAngle = Math.PI; // radians

  // How far you can orbit horizontally, upper and lower limits.
  // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
  this.minAzimuthAngle = -Infinity; // radians
  this.maxAzimuthAngle = Infinity; // radians

  // Set to true to enable damping (inertia)
  // If damping is enabled, you must call controls.update() in your animation loop
  this.enableDamping = false;
  this.dampingFactor = 0.25;

  // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
  // Set to false to disable zooming
  this.enableZoom = true;
  this.zoomSpeed = 1.0;

  // Set to false to disable rotating
  this.enableRotate = true;
  this.rotateSpeed = 1.0;

  // Set to false to disable panning
  this.enablePan = true;
  this.keyPanSpeed = 7.0; // pixels moved per arrow key push

  // Set to true to automatically rotate around the target
  // If auto-rotate is enabled, you must call controls.update() in your animation loop
  this.autoRotate = false;
  this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

  // Set to false to disable use of the keys
  this.enableKeys = true;

  // The four arrow keys
  this.keys = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    BOTTOM: 40
  };

  // Mouse buttons
  this.mouseButtons = {
    ORBIT: THREE.MOUSE.LEFT,
    ZOOM: THREE.MOUSE.MIDDLE,
    PAN: THREE.MOUSE.RIGHT
  };

  // for reset
  this.target0 = this.target.clone();
  this.position0 = this.object.position.clone();
  this.zoom0 = this.object.zoom;

  //
  // public methods
  //

  this.getPolarAngle = function() {

    return spherical.phi;

  };

  this.getAzimuthalAngle = function() {

    return spherical.theta;

  };

  this.reset = function() {

    scope.target.copy(scope.target0);
    scope.object.position.copy(scope.position0);
    scope.object.zoom = scope.zoom0;

    scope.object.updateProjectionMatrix();
    scope.dispatchEvent(changeEvent);

    scope.update();

    state = STATE.NONE;

  };

  // this method is exposed, but perhaps it would be better if we can make it private...
  this.update = function() {

    var offset = new THREE.Vector3();

    // so camera.up is the orbit axis
    var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
    var quatInverse = quat.clone().inverse();

    var lastPosition = new THREE.Vector3();
    var lastQuaternion = new THREE.Quaternion();

    return function update() {

      var position = scope.object.position;

      offset.copy(position).sub(scope.target);

      // rotate offset to "y-axis-is-up" space
      offset.applyQuaternion(quat);

      // angle from z-axis around y-axis
      spherical.setFromVector3(offset);

      if (scope.autoRotate && state === STATE.NONE) {

        rotateLeft(getAutoRotationAngle());

      }

      spherical.theta += sphericalDelta.theta;
      spherical.phi += sphericalDelta.phi;

      // restrict theta to be between desired limits
      spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

      // restrict phi to be between desired limits
      spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

      spherical.makeSafe();

      spherical.radius *= scale;

      // restrict radius to be between desired limits
      spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

      // move target to panned location
      scope.target.add(panOffset);

      offset.setFromSpherical(spherical);

      // rotate offset back to "camera-up-vector-is-up" space
      offset.applyQuaternion(quatInverse);

      position.copy(scope.target).add(offset);

      scope.object.lookAt(scope.target);

      if (scope.enableDamping === true) {

        sphericalDelta.theta *= (1 - scope.dampingFactor);
        sphericalDelta.phi *= (1 - scope.dampingFactor);

      } else {

        sphericalDelta.set(0, 0, 0);

      }

      scale = 1;
      panOffset.set(0, 0, 0);

      // update condition is:
      // min(camera displacement, camera rotation in radians)^2 > EPS
      // using small-angle approximation cos(x/2) = 1 - x^2 / 8

      if (zoomChanged ||
        lastPosition.distanceToSquared(scope.object.position) > EPS ||
        8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

        scope.dispatchEvent(changeEvent);

        lastPosition.copy(scope.object.position);
        lastQuaternion.copy(scope.object.quaternion);
        zoomChanged = false;

        return true;

      }

      return false;

    };

  }();

  this.dispose = function() {

    scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
    scope.domElement.removeEventListener('mousedown', onMouseDown, false);
    scope.domElement.removeEventListener('wheel', onMouseWheel, false);

    scope.domElement.removeEventListener('touchstart', onTouchStart, false);
    scope.domElement.removeEventListener('touchend', onTouchEnd, false);
    scope.domElement.removeEventListener('touchmove', onTouchMove, false);

    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('mouseup', onMouseUp, false);

    window.removeEventListener('keydown', onKeyDown, false);

    //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

  };

  //
  // internals
  //

  var scope = this;

  var changeEvent = {
    type: 'change'
  };
  var startEvent = {
    type: 'start'
  };
  var endEvent = {
    type: 'end'
  };

  var STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_DOLLY: 4,
    TOUCH_PAN: 5
  };

  var state = STATE.NONE;

  var EPS = 0.000001;

  // current position in spherical coordinates
  var spherical = new THREE.Spherical();
  var sphericalDelta = new THREE.Spherical();

  var scale = 1;
  var panOffset = new THREE.Vector3();
  var zoomChanged = false;

  var rotateStart = new THREE.Vector2();
  var rotateEnd = new THREE.Vector2();
  var rotateDelta = new THREE.Vector2();

  var panStart = new THREE.Vector2();
  var panEnd = new THREE.Vector2();
  var panDelta = new THREE.Vector2();

  var dollyStart = new THREE.Vector2();
  var dollyEnd = new THREE.Vector2();
  var dollyDelta = new THREE.Vector2();

  function getAutoRotationAngle() {

    return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

  }

  function getZoomScale() {

    return Math.pow(0.95, scope.zoomSpeed);

  }

  function rotateLeft(angle) {

    sphericalDelta.theta -= angle;

  }

  function rotateUp(angle) {

    sphericalDelta.phi -= angle;

  }

  var panLeft = function() {

    var v = new THREE.Vector3();

    return function panLeft(distance, objectMatrix) {

      v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
      v.multiplyScalar(-distance);

      panOffset.add(v);

    };

  }();

  var panUp = function() {

    var v = new THREE.Vector3();

    return function panUp(distance, objectMatrix) {

      v.setFromMatrixColumn(objectMatrix, 1); // get Y column of objectMatrix
      v.multiplyScalar(distance);

      panOffset.add(v);

    };

  }();

  // deltaX and deltaY are in pixels; right and down are positive
  var pan = function() {

    var offset = new THREE.Vector3();

    return function pan(deltaX, deltaY) {

      var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

      if (scope.object instanceof THREE.PerspectiveCamera) {

        // perspective
        var position = scope.object.position;
        offset.copy(position).sub(scope.target);
        var targetDistance = offset.length();

        // half of the fov is center to top of screen
        targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

        // we actually don't use screenWidth, since perspective camera is fixed to screen height
        panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
        panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

      } else if (scope.object instanceof THREE.OrthographicCamera) {

        // orthographic
        panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
        panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);

      } else {

        // camera neither orthographic nor perspective
        console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
        scope.enablePan = false;

      }

    };

  }();

  function dollyIn(dollyScale) {

    if (scope.object instanceof THREE.PerspectiveCamera) {

      scale /= dollyScale;

    } else if (scope.object instanceof THREE.OrthographicCamera) {

      scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
      scope.object.updateProjectionMatrix();
      zoomChanged = true;

    } else {

      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
      scope.enableZoom = false;

    }

  }

  function dollyOut(dollyScale) {

    if (scope.object instanceof THREE.PerspectiveCamera) {

      scale *= dollyScale;

    } else if (scope.object instanceof THREE.OrthographicCamera) {

      scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
      scope.object.updateProjectionMatrix();
      zoomChanged = true;

    } else {

      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
      scope.enableZoom = false;

    }

  }

  //
  // event callbacks - update the object state
  //

  function handleMouseDownRotate(event) {

    //console.log( 'handleMouseDownRotate' );

    rotateStart.set(event.clientX, event.clientY);

  }

  function handleMouseDownDolly(event) {

    //console.log( 'handleMouseDownDolly' );

    dollyStart.set(event.clientX, event.clientY);

  }

  function handleMouseDownPan(event) {

    //console.log( 'handleMouseDownPan' );

    panStart.set(event.clientX, event.clientY);

  }

  function handleMouseMoveRotate(event) {

    //console.log( 'handleMouseMoveRotate' );

    rotateEnd.set(event.clientX, event.clientY);
    rotateDelta.subVectors(rotateEnd, rotateStart);

    var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

    // rotating across whole screen goes 360 degrees around
    rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

    // rotating up and down along whole screen attempts to go 360, but limited to 180
    rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

    rotateStart.copy(rotateEnd);

    scope.update();

  }

  function handleMouseMoveDolly(event) {

    //console.log( 'handleMouseMoveDolly' );

    dollyEnd.set(event.clientX, event.clientY);

    dollyDelta.subVectors(dollyEnd, dollyStart);

    if (dollyDelta.y > 0) {

      dollyIn(getZoomScale());

    } else if (dollyDelta.y < 0) {

      dollyOut(getZoomScale());

    }

    dollyStart.copy(dollyEnd);

    scope.update();

  }

  function handleMouseMovePan(event) {

    //console.log( 'handleMouseMovePan' );

    panEnd.set(event.clientX, event.clientY);

    panDelta.subVectors(panEnd, panStart);

    pan(panDelta.x, panDelta.y);

    panStart.copy(panEnd);

    scope.update();

  }

  function handleMouseUp(event) {

    //console.log( 'handleMouseUp' );

  }

  function handleMouseWheel(event) {

    //console.log( 'handleMouseWheel' );

    if (event.deltaY < 0) {

      dollyOut(getZoomScale());

    } else if (event.deltaY > 0) {

      dollyIn(getZoomScale());

    }

    scope.update();

  }

  function handleKeyDown(event) {

    //console.log( 'handleKeyDown' );

    switch (event.keyCode) {

      case scope.keys.UP:
        pan(0, scope.keyPanSpeed);
        scope.update();
        break;

      case scope.keys.BOTTOM:
        pan(0, -scope.keyPanSpeed);
        scope.update();
        break;

      case scope.keys.LEFT:
        pan(scope.keyPanSpeed, 0);
        scope.update();
        break;

      case scope.keys.RIGHT:
        pan(-scope.keyPanSpeed, 0);
        scope.update();
        break;

    }

  }

  function handleTouchStartRotate(event) {

    //console.log( 'handleTouchStartRotate' );

    rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

  }

  function handleTouchStartDolly(event) {

    //console.log( 'handleTouchStartDolly' );

    var dx = event.touches[0].pageX - event.touches[1].pageX;
    var dy = event.touches[0].pageY - event.touches[1].pageY;

    var distance = Math.sqrt(dx * dx + dy * dy);

    dollyStart.set(0, distance);

  }

  function handleTouchStartPan(event) {

    //console.log( 'handleTouchStartPan' );

    panStart.set(event.touches[0].pageX, event.touches[0].pageY);

  }

  function handleTouchMoveRotate(event) {

    //console.log( 'handleTouchMoveRotate' );

    rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    rotateDelta.subVectors(rotateEnd, rotateStart);

    var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

    // rotating across whole screen goes 360 degrees around
    rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

    // rotating up and down along whole screen attempts to go 360, but limited to 180
    rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

    rotateStart.copy(rotateEnd);

    scope.update();

  }

  function handleTouchMoveDolly(event) {

    //console.log( 'handleTouchMoveDolly' );

    var dx = event.touches[0].pageX - event.touches[1].pageX;
    var dy = event.touches[0].pageY - event.touches[1].pageY;

    var distance = Math.sqrt(dx * dx + dy * dy);

    dollyEnd.set(0, distance);

    dollyDelta.subVectors(dollyEnd, dollyStart);

    if (dollyDelta.y > 0) {

      dollyOut(getZoomScale());

    } else if (dollyDelta.y < 0) {

      dollyIn(getZoomScale());

    }

    dollyStart.copy(dollyEnd);

    scope.update();

  }

  function handleTouchMovePan(event) {

    //console.log( 'handleTouchMovePan' );

    panEnd.set(event.touches[0].pageX, event.touches[0].pageY);

    panDelta.subVectors(panEnd, panStart);

    pan(panDelta.x, panDelta.y);

    panStart.copy(panEnd);

    scope.update();

  }

  function handleTouchEnd(event) {

    //console.log( 'handleTouchEnd' );

  }

  //
  // event handlers - FSM: listen for events and reset state
  //

  function onMouseDown(event) {

    if (scope.enabled === false) return;

    event.preventDefault();

    if (event.button === scope.mouseButtons.ORBIT) {

      if (scope.enableRotate === false) return;

      handleMouseDownRotate(event);

      state = STATE.ROTATE;

    } else if (event.button === scope.mouseButtons.ZOOM) {

      if (scope.enableZoom === false) return;

      handleMouseDownDolly(event);

      state = STATE.DOLLY;

    } else if (event.button === scope.mouseButtons.PAN) {

      if (scope.enablePan === false) return;

      handleMouseDownPan(event);

      state = STATE.PAN;

    }

    if (state !== STATE.NONE) {

      document.addEventListener('mousemove', onMouseMove, false);
      document.addEventListener('mouseup', onMouseUp, false);

      scope.dispatchEvent(startEvent);

    }

  }

  function onMouseMove(event) {

    if (scope.enabled === false) return;

    event.preventDefault();

    if (state === STATE.ROTATE) {

      if (scope.enableRotate === false) return;

      handleMouseMoveRotate(event);

    } else if (state === STATE.DOLLY) {

      if (scope.enableZoom === false) return;

      handleMouseMoveDolly(event);

    } else if (state === STATE.PAN) {

      if (scope.enablePan === false) return;

      handleMouseMovePan(event);

    }

  }

  function onMouseUp(event) {

    if (scope.enabled === false) return;

    handleMouseUp(event);

    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('mouseup', onMouseUp, false);

    scope.dispatchEvent(endEvent);

    state = STATE.NONE;

  }

  function onMouseWheel(event) {

    if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return;

    event.preventDefault();
    event.stopPropagation();

    handleMouseWheel(event);

    scope.dispatchEvent(startEvent); // not sure why these are here...
    scope.dispatchEvent(endEvent);

  }

  function onKeyDown(event) {

    if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

    handleKeyDown(event);

  }

  function onTouchStart(event) {

    if (scope.enabled === false) return;

    switch (event.touches.length) {

      case 1: // one-fingered touch: rotate

        if (scope.enableRotate === false) return;

        handleTouchStartRotate(event);

        state = STATE.TOUCH_ROTATE;

        break;

      case 2: // two-fingered touch: dolly

        if (scope.enableZoom === false) return;

        handleTouchStartDolly(event);

        state = STATE.TOUCH_DOLLY;

        break;

      case 3: // three-fingered touch: pan

        if (scope.enablePan === false) return;

        handleTouchStartPan(event);

        state = STATE.TOUCH_PAN;

        break;

      default:

        state = STATE.NONE;

    }

    if (state !== STATE.NONE) {

      scope.dispatchEvent(startEvent);

    }

  }

  function onTouchMove(event) {

    if (scope.enabled === false) return;

    event.preventDefault();
    event.stopPropagation();

    switch (event.touches.length) {

      case 1: // one-fingered touch: rotate

        if (scope.enableRotate === false) return;
        if (state !== STATE.TOUCH_ROTATE) return; // is this needed?...

        handleTouchMoveRotate(event);

        break;

      case 2: // two-fingered touch: dolly

        if (scope.enableZoom === false) return;
        if (state !== STATE.TOUCH_DOLLY) return; // is this needed?...

        handleTouchMoveDolly(event);

        break;

      case 3: // three-fingered touch: pan

        if (scope.enablePan === false) return;
        if (state !== STATE.TOUCH_PAN) return; // is this needed?...

        handleTouchMovePan(event);

        break;

      default:

        state = STATE.NONE;

    }

  }

  function onTouchEnd(event) {

    if (scope.enabled === false) return;

    handleTouchEnd(event);

    scope.dispatchEvent(endEvent);

    state = STATE.NONE;

  }

  function onContextMenu(event) {

    event.preventDefault();

  }

  //

  scope.domElement.addEventListener('contextmenu', onContextMenu, false);

  scope.domElement.addEventListener('mousedown', onMouseDown, false);
  scope.domElement.addEventListener('wheel', onMouseWheel, false);

  scope.domElement.addEventListener('touchstart', onTouchStart, false);
  scope.domElement.addEventListener('touchend', onTouchEnd, false);
  scope.domElement.addEventListener('touchmove', onTouchMove, false);

  window.addEventListener('keydown', onKeyDown, false);

  // force an update at start

  this.update();

};

THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

Object.defineProperties(THREE.OrbitControls.prototype, {

  center: {

    get: function() {

      console.warn('THREE.OrbitControls: .center has been renamed to .target');
      return this.target;

    }

  },

  // backward compatibility

  noZoom: {

    get: function() {

      console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
      return !this.enableZoom;

    },

    set: function(value) {

      console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
      this.enableZoom = !value;

    }

  },

  noRotate: {

    get: function() {

      console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
      return !this.enableRotate;

    },

    set: function(value) {

      console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
      this.enableRotate = !value;

    }

  },

  noPan: {

    get: function() {

      console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
      return !this.enablePan;

    },

    set: function(value) {

      console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
      this.enablePan = !value;

    }

  },

  noKeys: {

    get: function() {

      console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
      return !this.enableKeys;

    },

    set: function(value) {

      console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
      this.enableKeys = !value;

    }

  },

  staticMoving: {

    get: function() {

      console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
      return !this.enableDamping;

    },

    set: function(value) {

      console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
      this.enableDamping = !value;

    }

  },

  dynamicDampingFactor: {

    get: function() {

      console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
      return this.dampingFactor;

    },

    set: function(value) {

      console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
      this.dampingFactor = value;

    }

  }

});


var image = new Image();
image.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NkVCQjAyMjc2OTMyMTFFNUEzRjBBNDg2RDAxOTdGQTUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NkVCQjAyMjg2OTMyMTFFNUEzRjBBNDg2RDAxOTdGQTUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo2RUJCMDIyNTY5MzIxMUU1QTNGMEE0ODZEMDE5N0ZBNSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo2RUJCMDIyNjY5MzIxMUU1QTNGMEE0ODZEMDE5N0ZBNSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PpE78ukAACsaSURBVHja7H1pkCTH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';

var texture = new THREE.Texture();
texture.image = image;
image.onload = function() {
	texture.needsUpdate = true;
};



texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;

var material = new THREE.MeshLambertMaterial( { 
  map: texture,
   shininess: 100

} );


var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
var back = false;

var controls = new THREE.OrbitControls( camera );
controls.mouseButtons = {
    ORBIT: THREE.MOUSE.RIGHT,
    ZOOM: THREE.MOUSE.MIDDLE,
    PAN: THREE.MOUSE.LEFT
  };

controls.enableDamping = true; 
controls.dampingFactor = 0.12;  
controls.rotateSpeed = 0.08; 
controls.autoRotate = false;
controls.autoRotateSpeed = 0.08;
controls.maxPolarAngle = Math.PI/2;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; //Shadow
renderer.shadowMapSoft = true; // Shadow
renderer.shadowMap.type = THREE.PCFShadowMap; //Shadow
document.body.appendChild(renderer.domElement);

// Define Geometry
var geometry = new THREE.BoxGeometry(1, 1, 1);

//Cube
var cube = new THREE.Mesh(geometry, material);
cube.position.y = 1;
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);
camera.position.x = 0;
camera.position.y = 1.8;
camera.position.z = 3;

// Floor
var floorGeometry = new THREE.PlaneGeometry(100, 100, 20, 20);
var floorMaterial = new THREE.MeshPhongMaterial({
  color: 0xecebec,
  specular: 0x000000,
  shininess: 100
});

var floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -0.5 * Math.PI;
floor.receiveShadow = true;
scene.add(floor);

// Lights
// Ambient light for general illumination
var ambientLight = new THREE.AmbientLight(0x090909);
scene.add(ambientLight);

// Spotlight for specific illumination
var spotLight = new THREE.SpotLight(0xAAAAAA);
spotLight.position.set(2, 3, 3);
spotLight.castShadow = true;
spotLight.shadow.bias = 0.0001;
spotLight.shadow.mapSize.width = 2048; // Shadow Quality
spotLight.shadow.mapSize.height = 2048; // Shadow Quality
scene.add(spotLight);

// Render Loop
function render() {
  requestAnimationFrame(render); 
  
  // A simple back and forth animation
 cube.rotation.y+=0.01;
  cube.rotation.z+=0.01;
  
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener( 'resize', onWindowResize, false );
render();

// Functions :

function onWindowResize() {
	  camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
}
