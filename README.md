ThreeSS
=======

Centralized styling for THREE.js objects.  ThreeSS allows developers to style their THREE.js
objects in a similar fashion to CSS.


Build Status
------------

<table>
  <tr><td>Master</td><td><a href="http://travis-ci.org/Vannevartech/threess" target="_blank"><img src="https://secure.travis-ci.org/Vannevartech/threess.png?branch=master" /></a></tr>
</table>


Example Code
------------
```javascript

    // Setup global styles (aka the stylesheet)
    var style = new ThreeSS.StyleContext();
    style.addRule('sphere', { material: 'meshLambert' });
    style.addRule('.hot',   { color: 0xff4300, emissive: 0x440000 });
    style.addRule('.cool',  { color: 0x3efffc, emissive: 0x102044 });

    // Create some regular THREE objects with just dummy materials
    var sphereGeom = new THREE.SphereGeometry(25, 10, 10),
        sphere = new THREE.Mesh(sphereGeom, new THREE.MeshBasicMaterial());

    // Link the styles to the THREE objects
    var sphereStyle = style.declareObject('sphere', 'hot');
    sphereStyle.applyMaterialOnChange(sphere);

    style.process();  // Ensure that all styles have propagated to THREE objects

    // Change the sphere's style.
    sphereStyle.addClass('cool').removeClass('hot')
```

Examples
--------
You can play with the examples that ship with ThreeSS by starting a simple webserver:
```bash
    $ npm run examples
```
Point your web browser at http://localhost:7123/examples

The ThreeSS repository contains a couple examples from THREE.js that have been styled with
ThreeSS.  The examples are:
* webgl_geometry_shapes.html - Demonstrates basic styling including composition of selectors
* webgl_mirror.html - Demonstrates styling things with no material (such as lights or size of objects)

The examples make use of a style editor written using Angular.  The style editor is not part of
the core ThreeSS library and is only available under the examples directory.


Motivation
----------
Tuning the colors and styles of objects within a THREE scene can be a time consuming process.
The goal in creating ThreeSS was to centralize the styles into a single place (a stylesheet) and
allow developers to use CSS style rules (with selectors) to modify the attributes of materials and
objects.



Getting Started
---------------
Include the following scripts in your HTML:
```
        <script src="threess/lib/Slick.Finder.js"></script>
        <script src="threess/lib/Slick.Parser.js"></script>
        <script src="threess/threess.js"></script>
```
ThreeSS exports itself into the global context for now and can be accessed as in the above example.




Running the Tests
-----------------

Before running the test suite for the first time:

    $ npm install

To run the suite in phantomJS:

    $ npm test



Copyright
---------

Copyright 2013 the original author or authors

threess.js is made available under the MIT license.  See LICENSE.txt for details.


Change Log
----------

No releases yet
