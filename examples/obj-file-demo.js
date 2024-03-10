import {defs, tiny} from './common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}

export class Obj_File_Demo extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
                                                                     // Detailed model files can be used in place of simpler primitive-based
                                                                     // shapes to add complexity to a scene.  Simpler primitives in your scene
                                                                     // can just be thought of as placeholders until you find a model file
                                                                     // that fits well.  This demo shows the teapot model twice, with one
                                                                     // teapot showing off the Fake_Bump_Map effect while the other has a
                                                                     // regular texture and Phong lighting.
    constructor() {
        super();
        // Load the model file:

        this.shapes = {
            face: new Shape_From_File("assets/face_old.obj"),
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            sphere1: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sphere2: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            sphere3: new defs.Subdivision_Sphere(3),
            circle: new defs.Regular_2D_Polygon(1, 15),
            ring: new defs.Torus(50, 50),
            rectangle: new defs.Cube(),
            square: new defs.Square(),
            cylinder: new defs.Cylindrical_Tube(),
            triangle: new defs.Triangle(),

            // TODO:  Fill in as many additional shape instances as needed in this key/value table.
            //        (Requirement 1)
        };
        //this.shapes = {"face": new Shape_From_File("assets/face_old.obj")};

        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: 0.3, diffusivity: 0.5, specularity: 0, color: color(0.878, 0.675, 0.412,1 )})
        }

        this.position_horizontal = 0;
    }
    make_control_panel() {
        this.key_triggered_button("Move right", ["r"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.position_horizontal += 1;
        });

        this.key_triggered_button("Move left", ["r"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.position_horizontal -= 1;
        });
    }



    display(context, program_state) {
        const t = program_state.animation_time;
        program_state.set_camera(Mat4.translation(0, 0, -5));    // Locate the camera here (inverted matrix).
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        const light_position = vec4(0, 3, 10, 1);
        program_state.lights = [new Light(light_position, color(1, .7, .7, 1), 100000)];

        const eye_radius = 0.03; // Radius of the eyes
        const eye_offset = 0.10; // Offset of the eyes from the center of the head
        let eye_color = color(0,0,0,1);
        const left_eye_transform = Mat4.translation(-eye_offset + this.position_horizontal/1.5, -0.1, 2).times(Mat4.scale(eye_radius, eye_radius*1.2, eye_radius));
        const right_eye_transform = Mat4.translation(eye_offset + this.position_horizontal/1.5, -0.1, 2).times(Mat4.scale(eye_radius, eye_radius*1.2, eye_radius)); // Translate right eye

        this.shapes.sphere.draw(
            context,
            program_state,
            left_eye_transform, // Scale the eye
            this.materials.test.override({ambient: 1, color: eye_color}) // Use maximum ambient and specified eye color
        );



        this.shapes.square.draw(
            context,
            program_state,
            Mat4.translation(0, -10, 0)
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
                .times(Mat4.scale(50, 50, 1)),
            this.materials.test.override({ambient: 0.8, texture: new Texture("assets/stars.png", "LINEAR_MIPMAP_LINEAR")})
        );


        /*
        this.shapes.sphere.draw(
            context,
            program_state,
            right_eye_transform, // Scale the eye
            this.materials.test.override({ambient: 1, color: eye_color}) // Use maximum ambient and specified eye color
        );
         */


        let face_transform = Mat4.translation(this.position_horizontal, 0, 0).times(Mat4.scale(0.3 ,0.3,0.3));
        this.shapes.face.draw(context, program_state, face_transform, this.materials.test);



    }

}