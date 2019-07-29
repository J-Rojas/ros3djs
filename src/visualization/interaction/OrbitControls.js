/**
 * @author David Gossow - dgossow@willowgarage.com
 * @author Xueqiao Xu - xueqiaoxu@gmail.com
 * @author Mr.doob - http://mrdoob.com
 * @author AlteredQualia - http://alteredqualia.com
 */

/**
 * Behaves like THREE.OrbitControls, but uses right-handed coordinates and z as up vector.
 *
 * @constructor
 * @param scene - the global scene to use
 * @param camera - the camera to use
 * @param userZoomSpeed (optional) - the speed for zooming
 * @param userRotateSpeed (optional) - the speed for rotating
 * @param autoRotate (optional) - if the orbit should auto rotate
 * @param autoRotateSpeed (optional) - the speed for auto rotating
 * @param displayPanAndZoomFrame - whether to display a frame when panning/zooming
 *                                 (defaults to true)
 * @param lineTypePanAndZoomFrame - line type for the frame that is displayed when
 *                                  panning/zooming. Only has effect when
 *                                  displayPanAndZoomFrame is set to true.
 */
ROS3D.OrbitControls = function(options) {
  const up = new THREE.Vector3( 0, 0, 1 );
  THREE.OrbitControls.call(this, options.camera, options.domElement, up);
  var that = this;
  options = options || {};
  var scene = options.scene;
  this.camera = options.camera;
  this.target = new THREE.Vector3();
  this.userZoom = true;
  this.userZoomSpeed = options.userZoomSpeed || 1.0;
  this.userRotate = true;
  this.userRotateSpeed = options.userRotateSpeed || 1.0;
  this.autoRotate = options.autoRotate;
  this.autoRotateSpeed = options.autoRotateSpeed || 2.0;
  this.displayPanAndZoomFrame = (options.displayPanAndZoomFrame === undefined) ?
      true :
      !!options.displayPanAndZoomFrame;
  this.lineTypePanAndZoomFrame = options.dashedPanAndZoomFrame || 'full';
  // In ROS, z is pointing upwards
  this.camera.up = new THREE.Vector3(0, 0, 1);

  // internals
  var pixelsPerRound = 1800;
  var touchMoveThreshold = 10;
  var rotateStart = new THREE.Vector2();
  var rotateEnd = new THREE.Vector2();
  var rotateDelta = new THREE.Vector2();
  var zoomStart = new THREE.Vector2();
  var zoomEnd = new THREE.Vector2();
  var zoomDelta = new THREE.Vector2();
  var moveStartCenter = new THREE.Vector3();
  var moveStartNormal = new THREE.Vector3();
  var moveStartPosition = new THREE.Vector3();
  var moveStartIntersection = new THREE.Vector3();
  var touchStartPosition = new Array(2);
  var touchMoveVector = new Array(2);
  this.phiDelta = 0;
  this.thetaDelta = 0;
  this.scale = 1;
  this.lastPosition = new THREE.Vector3();
  // internal states
  var STATE = {
    NONE : -1,
    ROTATE : 0,
    ZOOM : 1,
    MOVE : 2
  };
  var state = STATE.NONE;

  this.axes = new ROS3D.Axes({
    shaftRadius : 0.025,
    headRadius : 0.07,
    headLength : 0.2,
    lineType: this.lineTypePanAndZoomFrame
  });
  if (this.displayPanAndZoomFrame) {
    // initially not visible
    scene.add(this.axes);
    this.axes.traverse(function(obj) {
      obj.visible = false;
    });
  }

  this.initEventMethods(options);

};

ROS3D.OrbitControls.prototype.initEventMethods = function(options) {
  // override event methods
  var self = this; //do not use 'that'; the transpiler will assume these are super calls
  const onContextMenu = this.onContextMenu;
  this.onContextMenu = function(e) {
    onContextMenu.call(self, e);
    self.showAxes();
  };

  const onMouseDown = this.onMouseDown;
  this.onMouseDown = function(e) {
    onMouseDown.call(self, e);
    self.showAxes();
  };

  const onMouseWheel = this.onMouseWheel;
  this.onMouseWheel = function(e) {
    onMouseWheel.call(self, e);
    self.showAxes();
  };

  const onTouchStart = this.onTouchStart;
  this.onTouchStart = function(e) {
    onTouchStart.call(self, e);
    self.showAxes();
  };

  const onTouchEnd = this.onTouchEnd;
  this.onTouchEnd = function(e) {
    onTouchEnd.call(self, e);
    self.showAxes();
  };

  const onTouchMove = this.onTouchMove;
  this.onTouchMove = function(e) {
    onTouchMove.call(self, e);
    if (self.state !== self.STATE.NONE) {
      self.showAxes();
    }
  };

  const onMouseMove = this.onMouseMove;
  this.onMouseMove = function(e) {
    if (self.state !== self.STATE.NONE) {
      onMouseMove.call(self, e);    
      self.showAxes();
    }
  };

  const onMouseUp = this.onMouseUp;
  this.onMouseUp = function(e) {
    onMouseUp.call(self, e);
    self.showAxes();
  };

  const onKeyDown = this.onKeyDown;
  this.onKeyDown = function(e) {
    onKeyDown.call(self, e);
    self.showAxes();
  };

  //reassign event handlers
  options.domElement.removeEventListener('contextmenu', onContextMenu);
  options.domElement.addEventListener('contextmenu', this.onContextMenu);

  options.domElement.removeEventListener('mousedown', onMouseDown);
  options.domElement.addEventListener('mousedown', this.onMouseDown);

  options.domElement.removeEventListener('wheel', onMouseWheel);
  options.domElement.addEventListener('wheel', this.onMouseWheel);

  options.domElement.removeEventListener('touchstart', onTouchStart);
  options.domElement.addEventListener('touchstart', this.onTouchStart);

  options.domElement.removeEventListener('touchend', onTouchEnd);
  options.domElement.addEventListener('touchend', this.onTouchEnd);

  options.domElement.removeEventListener('touchmove', onTouchMove);
  options.domElement.addEventListener('touchmove', this.onTouchMove);

  options.domElement.removeEventListener('mousemove', onMouseMove);
  options.domElement.addEventListener('mousemove', this.onMouseMove);

  options.domElement.removeEventListener('mouseup', onMouseUp);
  options.domElement.addEventListener('mouseup', this.onMouseUp);

  options.domElement.removeEventListener('keydown', onKeyDown);
  options.domElement.addEventListener('keydown', this.onKeyDown);

  // override superclass methods
  this.rotateLeft = ROS3D.OrbitControls.prototype.rotateLeft;
  this.rotateRight = ROS3D.OrbitControls.prototype.rotateRight;
  this.rotateUp = ROS3D.OrbitControls.prototype.rotateUp;
  this.rotateDown = ROS3D.OrbitControls.prototype.rotateDown;
  this.zoomIn = ROS3D.OrbitControls.prototype.zoomIn;
  this.zoomOut = ROS3D.OrbitControls.prototype.zoomOut;

};

/**
 * Display the main axes for 1 second.
 */
ROS3D.OrbitControls.prototype.showAxes = function() {
  var that = this;

  this.axes.traverse(function(obj) {
    obj.visible = true;
  });
  if (this.hideTimeout) {
    clearTimeout(this.hideTimeout);
  }
  this.hideTimeout = setTimeout(function() {
    that.axes.traverse(function(obj) {
      obj.visible = false;
    });
    that.hideTimeout = false;
  }, 1000);
};

/**
 * Rotate the camera to the left by the given angle.
 *
 * @param angle (optional) - the angle to rotate by
 */
ROS3D.OrbitControls.prototype.rotateLeft = function(angle) {
  if (angle === undefined) {
    angle = 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }
  this.sphericalDelta.theta += angle;
};

/**
 * Rotate the camera to the right by the given angle.
 *
 * @param angle (optional) - the angle to rotate by
 */
ROS3D.OrbitControls.prototype.rotateRight = function(angle) {
  if (angle === undefined) {
    angle = 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }
  this.sphericalDelta.theta -= angle;
};

/**
 * Rotate the camera up by the given angle.
 *
 * @param angle (optional) - the angle to rotate by
 */
ROS3D.OrbitControls.prototype.rotateUp = function(angle) {
  if (angle === undefined) {
    angle = 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }
  this.sphericalDelta.phi += angle;
};

/**
 * Rotate the camera down by the given angle.
 *
 * @param angle (optional) - the angle to rotate by
 */
ROS3D.OrbitControls.prototype.rotateDown = function(angle) {
  if (angle === undefined) {
    angle = 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }
  this.sphericalDelta.phi -= angle;
};

/**
 * Zoom in by the given scale.
 *
 * @param zoomScale (optional) - the scale to zoom in by
 */
ROS3D.OrbitControls.prototype.zoomIn = function(zoomScale) {
  if (zoomScale === undefined) {
    zoomScale = Math.pow(0.95, this.userZoomSpeed);
  }
  this.scale /= zoomScale;
};

/**
 * Zoom out by the given scale.
 *
 * @param zoomScale (optional) - the scale to zoom in by
 */
ROS3D.OrbitControls.prototype.zoomOut = function(zoomScale) {
  if (zoomScale === undefined) {
    zoomScale = Math.pow(0.95, this.userZoomSpeed);
  }
  this.scale *= zoomScale;
};

Object.assign(ROS3D.OrbitControls.prototype, THREE.OrbitControls.prototype);
