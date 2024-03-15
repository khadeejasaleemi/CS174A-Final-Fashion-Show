import {defs, tiny} from './common.js';
import {Body, Test_Data} from "./collisions-demo.js";

// Pull these names into this module's scope for convenience:
//const {vec3, unsafe3, vec4, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;
const {vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class BoundingBox {
    constructor(min, max) {
        this.min = min; // vec3(x, y, z)
        this.max = max; // vec3(x, y, z)
    }

    // Check if this bounding box intersects with another
    intersects(other) {
        return (
            this.min[0] <= other.max[0] && this.max[0] >= other.min[0] &&
            this.min[1] <= other.max[1] && this.max[1] >= other.min[1] &&
            this.min[2] <= other.max[2] && this.max[2] >= other.min[2]
        );
    }
}
export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
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

export class Text_Line extends Shape {                           // **Text_Line** embeds text in the 3D world, using a crude texture
                                                                 // method.  This Shape is made of a horizontal arrangement of quads.
                                                                 // Each is textured over with images of ASCII characters, spelling
                                                                 // out a string.  Usage:  Instantiate the Shape with the desired
                                                                 // character line width.  Then assign it a single-line string by calling
                                                                 // set_string("your string") on it. Draw the shape on a material
                                                                 // with full ambient weight, and text.png assigned as its texture
                                                                 // file.  For multi-line strings, repeat this process and draw with
                                                                 // a different matrix.
    constructor(max_size) {
        super("position", "normal", "texture_coord");
        this.max_size = max_size;
        var object_transform = Mat4.identity();
        for (var i = 0; i < max_size; i++) {                                       // Each quad is a separate Square instance:
            defs.Square.insert_transformed_copy_into(this, [], object_transform);
            object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
        }
    }

    set_string(line, context) {           // set_string():  Call this to overwrite the texture coordinates buffer with new
        // values per quad, which enclose each of the string's characters.
        this.arrays.texture_coord = [];
        for (var i = 0; i < this.max_size; i++) {
            var row = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) / 16),
                col = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) % 16);

            var skip = 3, size = 32, sizefloor = size - skip;
            var dim = size * 16,
                left = (col * size + skip) / dim, top = (row * size + skip) / dim,
                right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

            this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
                [left, 1 - top], [right, 1 - top]));
        }
        if (!this.existing) {
            this.copy_onto_graphics_card(context);
            this.existing = true;
        } else
            this.copy_onto_graphics_card(context, ["texture_coord"], false);
    }
}

export class Simulation extends Scene {
    // **Simulation** manages the stepping of simulation time.  Subclass it when making
    // a Scene that is a physics demo.  This technique is careful to totally decouple
    // the simulation from the frame rate (see below).
    constructor() {
        super();
        Object.assign(this, {time_accumulator: 0, time_scale: 1/1000.0, t: 0, dt: 1 / 50, bodies: [], steps_taken: 0});
    }

    simulate(frame_time) {
        // simulate(): Carefully advance time according to Glenn Fiedler's
        // "Fix Your Timestep" blog post.
        // This line gives ourselves a way to trick the simulator into thinking
        // that the display framerate is running fast or slow:
        frame_time = this.time_scale * frame_time;

        // Avoid the spiral of death; limit the amount of time we will spend
        // computing during this timestep if display lags:
        this.time_accumulator += Math.min(frame_time, 0.1);
        // Repeatedly step the simulation until we're caught up with this frame:
        while (Math.abs(this.time_accumulator) >= this.dt) {
            // Single step of the simulation for all bodies:
            this.update_state(this.dt);
            for (let b of this.bodies)
                b.advance(this.dt);
            // Following the advice of the article, de-couple
            // our simulation time from our frame rate:
            this.t += Math.sign(frame_time) * this.dt;
            this.time_accumulator -= Math.sign(frame_time) * this.dt;
            this.steps_taken++;
        }
        // Store an interpolation factor for how close our frame fell in between
        // the two latest simulation time steps, so we can correctly blend the
        // two latest states and display the result.
        let alpha = this.time_accumulator / this.dt;
        for (let b of this.bodies) b.blend_state(alpha);
    }


    display(context, program_state) {
        // display(): advance the time and state of our whole simulation.
        if (program_state.animate)
            this.simulate(program_state.animation_delta_time);
        // Draw each shape at its current location:
        for (let b of this.bodies)
            b.shape.draw(context, program_state, b.drawn_location, b.material);
    }

    update_state(dt)      // update_state(): Your subclass of Simulation has to override this abstract function.
    {
        throw "Override this"
    }
}

export class Control_Demo extends Simulation {
    // ** Inertia_Demo** demonstration: This scene lets random initial momentums
    // carry several bodies until they fall due to gravity and bounce.
    constructor() {
        super();
        this.data = new Test_Data();
        //this.face = new Shape_From_File("assets/face_old.obj");

        this.shapes = {
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            sphere1: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sphere2: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            sphere3: new defs.Subdivision_Sphere(3),
            circle: new defs.Regular_2D_Polygon(1, 15),
            ring: new defs.Torus(50, 50),
            cube: new defs.Cube(),
            square: new defs.Square(),
            cylinder: new defs.Cylindrical_Tube(),
            triangle: new defs.Triangle(),
            leg1: new defs.Cube(),
            leg2: new defs.Cube(),
            test_body: new defs.Cube(),
            world: new defs.Subdivision_Sphere(4),
        };
        //this.shapes = Object.assign({}, this.data.shapes);
        //this.shapes.square = new defs.Square();
        const shader = new defs.Fake_Bump_Map(1);
        this.material = new Material(shader, {
            color: color(0, 0, 0, 1),
            ambient: .5
        })
        // The agent
        this.agent = new Shape_From_File("assets/face.obj");
        this.agent_pos = vec3(0, -4, 0);
        this.agent_size = 5.0;

        this.control = {};
        this.control.w = false;
        this.control.a = false;
        this.control.s = false;
        this.control.d = false;
        this.control.space = false;

        this.clothing = {
            shirt: new Shape_From_File("assets/shirt.obj"),
            dress: new Shape_From_File("assets/dress.obj"),
            dress2: new Shape_From_File("assets/dress2.obj"),
            shirt1: new Shape_From_File("assets/shirt1.obj"),
            shirt2: new Shape_From_File("assets/shirt2.obj"),
            shirt3: new Shape_From_File("assets/shirt3.obj"),
            pant: new Shape_From_File("assets/pant.obj"),
        }

        this.hair = new Shape_From_File("assets/hair.obj");
        this.stand = new Shape_From_File("assets/stand.obj");
        this.smile = new Shape_From_File("assets/smile.obj");
        this.neck = new Shape_From_File("assets/neck.obj");
        this.body = new Shape_From_File("assets/body_new.obj");
        this.leg = new Shape_From_File("assets/leg.obj");


        this.new_material = new Material(new defs.Phong_Shader(), {
            ambient: 0.5,
            diffusivity: 0.5,
            specularity: 0,
            color: color(0.878, 0.675, 0.412, 1),
        });

        this.leg1_material = new Material(new defs.Phong_Shader(), {
            ambient: 1.0,
            diffusivity: 0.5,
            specularity: 0,
            color: color(0, .3, 0, 1),
        });

        this.leg2_material = new Material(new defs.Phong_Shader(), {
            ambient: 1.0,
            diffusivity: 0.5,
            specularity: 0,
            color: color(.3, 0., 0., 1),
        });

        this.body_material = new Material(new defs.Phong_Shader(), {
            ambient: 1.0,
            diffusivity: 0.5,
            specularity: 0,
            color: color(1., 1., 1., 1),
        });
        this.world_material = new Material(new defs.Phong_Shader(), {
            ambient: 1.0,
            diffusivity: 0,
            specularity: 0,
            color: color(0.5294, 0.8078, 0.9216, 1),
        });

        this.speed = 10;

        // Define bounding boxes for walls and the head
        // (collisions against walls were found with some trial and error by adjusting coords)
        this.wallLeft = new BoundingBox(vec3(-97, -10, -50), vec3(-96, 70, 100));  // Adjusted to be slightly inward
        this.wallRight = new BoundingBox(vec3(96, -10, -50), vec3(97, 68, 100));   // Adjusted to be slightly inward
        this.wallBack = new BoundingBox(vec3(-100, -10, -25), vec3(100, 70, -24));
        this.wallFront = new BoundingBox(vec3(-100, -10, 100), vec3(100, 50, 101));
        this.headMainBox = new BoundingBox(vec3(-2.5, -6.5, -2.5), vec3(2.5, -1.5, 2.5));

        // Assuming the head is centered at the origin (0,0,0), and the ears are symmetrical
        // The negative x-direction is to the left, and the positAive x-direction is to the right
        this.headEarLeftBox = new BoundingBox(vec3(-1.5, -5, -1), vec3(-2, -3, 1));  // Extended outward on the left
        this.headEarRightBox = new BoundingBox(vec3(2, -5, -1), vec3(3.5, -3, 1));   // Extended outward on the right
    }

    random_color() {
        return this.material.override(color(.6, .6 * Math.random(), .6 * Math.random(), 1));
    }

    make_control_panel() {
        super.make_control_panel();
        this.new_line();
        this.key_triggered_button("Back", ["Shift", "W"],
            () => this.control.w = true, '#6E6460', () => this.control.w = false);
        this.key_triggered_button("Forward",   ["Shift", "S"],
            () => this.control.s = true, '#6E6460', () => this.control.s = false);
        this.key_triggered_button("Left",   ["Shift", "A"],
            () => this.control.a = true, '#6E6460', () => this.control.a = false);
        this.key_triggered_button("Right",  ["Shift", "D"],
            () => this.control.d = true, '#6E6460', () => this.control.d = false);
        this.key_triggered_button("Speed Up",  ["Shift", " "],
            () => this.control.speed_up = true, '#6E6460', () => this.control.speed_up= false);
        this.key_triggered_button("Slow down",  ["Shift",  "Tab"],
            () => this.control.slow_down = true, '#6E6460', () => this.control.slow_down = false);

    }

    willCollide(newPos) {
        let newHeadMainBox = new BoundingBox(
            vec3(newPos[0] + this.headMainBox.min[0], newPos[1] + this.headMainBox.min[1], newPos[2] + this.headMainBox.min[2]),
            vec3(newPos[0] + this.headMainBox.max[0], newPos[1] + this.headMainBox.max[1], newPos[2] + this.headMainBox.max[2])
        );
        let newHeadEarLeftBox = new BoundingBox(
            vec3(newPos[0] + this.headEarLeftBox.min[0], newPos[1] + this.headEarLeftBox.min[1], newPos[2] + this.headEarLeftBox.min[2]),
            vec3(newPos[0] + this.headEarLeftBox.max[0], newPos[1] + this.headEarLeftBox.max[1], newPos[2] + this.headEarLeftBox.max[2])
        );
        let newHeadEarRightBox = new BoundingBox(
            vec3(newPos[0] + this.headEarRightBox.min[0], newPos[1] + this.headEarRightBox.min[1], newPos[2] + this.headEarRightBox.min[2]),
            vec3(newPos[0] + this.headEarRightBox.max[0], newPos[1] + this.headEarRightBox.max[1], newPos[2] + this.headEarRightBox.max[2])
        );

        return this.wallLeft.intersects(newHeadMainBox) ||
            this.wallRight.intersects(newHeadMainBox) ||
            this.wallBack.intersects(newHeadMainBox) ||
            this.wallFront.intersects(newHeadMainBox) ||
            this.wallLeft.intersects(newHeadEarLeftBox) ||
            this.wallRight.intersects(newHeadEarLeftBox) ||
            this.wallBack.intersects(newHeadEarLeftBox) ||
            this.wallLeft.intersects(newHeadEarRightBox) ||
            this.wallRight.intersects(newHeadEarRightBox) ||
            this.wallBack.intersects(newHeadEarRightBox);
    }
    update_state(dt) {
        // update_state():  Override the base time-stepping code to say what this particular
        // scene should do to its bodies every frame -- including applying forces.
        // Generate additional moving bodies if there ever aren't enough:
        // Control
        //let speed = 10.0;

        if (this.control.speed_up){
            this.speed += 1.2;
            if (this.speed > 46)
                this.speed = 46;
        }
        if (this.control.slow_down){
            this.speed -= 1.2;
            if (this.speed <= 0)
                this.speed = 1.2;
        }

        if (this.control.w && !this.willCollide(vec3(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2] - dt * this.speed))) {
            this.agent_pos[2] -= dt * this.speed;
        }
        if (this.control.s && !this.willCollide(vec3(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2] + dt * this.speed))) {
            this.agent_pos[2] += dt * this.speed;
        }
        if (this.control.a && !this.willCollide(vec3(this.agent_pos[0] - dt * this.speed, this.agent_pos[1], this.agent_pos[2]))) {
            this.agent_pos[0] -= dt * this.speed;
        }
        if (this.control.d && !this.willCollide(vec3(this.agent_pos[0] + dt * this.speed, this.agent_pos[1], this.agent_pos[2]))) {
            this.agent_pos[0] += dt * this.speed;
        }


    }

    display(context, program_state) {
        // display(): Draw everything else in the scene besides the moving bodies.
        super.display(context, program_state);

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            this.children.push(new defs.Program_State_Viewer());
            program_state.set_camera(Mat4.translation(-3.15, -2.80, -82.10));    // Locate the camera here (inverted matrix).
        }
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        //program_state.lights = [new Light(vec4(0, -5, -10, 1), color(1, 1, 1, 1), 100000)];

// Define light parameters
        const light_position1 = vec4(0, -10, 50, 1); // Adjust position as needed (front light)
        const light_position2 = vec4(0, 3, -5, 1); // Adjust position as needed (middle left)
        const light_color = color(1, 1, 1, 1); // Adjust color as needed
        const light_intensity = 1000000; // Adjust intensity as needed

// Create the light object

        const light1 = new Light(light_position1, light_color, light_intensity);
        const light2 = new Light(light_position2, light_color, light_intensity);

// Set the light for the program state
        program_state.lights = [light1, light2];

        //the time
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        //the world
        let world_matrix = Mat4.scale(200, 200, 200).times(Mat4.identity());

        this.shapes.world.draw(
            context,
            program_state,
            world_matrix,
            this.world_material
        );

        //the ground:
        this.shapes.square.draw(context, program_state, Mat4.translation(0, -10, 0)
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(100, 100, 2)),
            this.material.override({ambient:.8, texture: this.data.textures.ground2}));


        this.shapes.square.draw(context, program_state, Mat4.translation(100, 30, 0)
                .times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.scale(100, 40, 2)),
            this.material.override({ambient:.8, texture: this.data.textures.wall}));

        this.shapes.square.draw(context, program_state, Mat4.translation(-100, 30 ,0)
                .times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.scale(100, 40, 2)),
            this.material.override({ambient:.8, texture: this.data.textures.wall}));

        this.shapes.square.draw(context, program_state, Mat4.translation(0, 30, -25)
                .times(Mat4.rotation(Math.PI, 0, 1, 0)).times(Mat4.scale(100, 40, 2)),
            this.material.override({ambient:.8, texture: this.data.textures.wall}));


        this.shapes.square.draw(context, program_state, Mat4.translation(0, -10, 0)
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(100, 100, 2)),
            this.material.override({ambient:.8, texture: this.data.textures.sky}));

        let agent_trans_s = Mat4.translation(0, -4, 0)
            .times(Mat4.rotation(Math.PI, 0, 1, 0)) // Rotate 180 degrees around the y-axis
            .times(Mat4.scale(this.agent_size, this.agent_size, this.agent_size*0.6)).times(Mat4.translation(0, 4, 0));


        let agent_trans = Mat4.translation(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2])
            .times(Mat4.rotation(Math.PI, 0, 1, 0)) // Rotate 180 degrees around the y-axis
            .times(Mat4.scale(this.agent_size, this.agent_size, this.agent_size*0.6)).times(Mat4.translation(0, 4, 0));


        const eye_radius = 0.2; // Radius of the eyes
        const eye_offset = 0.6; // Offset of the eyes from the center of the head
        let eye_color = color(0,0,0,1);
        let white = color(1,1,1,1) ;

// Apply the agent transformation to the eye transformation
        let left_eye_transform = agent_trans.times(Mat4.translation(eye_offset+0.06, 0.1, -0.65)
            .times(Mat4.scale(0.16, 0.16, 0.2)));
        let right_eye_transform = agent_trans.times(Mat4.translation(-eye_offset-0.06, 0.1, -0.65)
            .times(Mat4.scale(0.16, 0.16, 0.2)));
        let right_white_eye_transform = agent_trans.times(Mat4.translation(-eye_offset - 0.1, 0.1, -0.6)
            .times(Mat4.scale(0.25, 0.16, 0.2)));
        let left_white_eye_transform = agent_trans.times(Mat4.translation(eye_offset + 0.1, 0.1, -0.6)
            .times(Mat4.scale(0.25, 0.16, 0.2)));


        let smile_color = color(0.6,0,0,1);


        let transformationList = [ agent_trans.times(
            Mat4.translation(0,-2.5,-0.1)
        ).times(
            Mat4.rotation(-Math.PI/1.7, 0, 1, 0)
        ).times(
            Mat4.scale(1,1,1)
        )];

        this.shapes.sphere.draw(
            context,
            program_state,
            left_eye_transform, // Scale the eye
            this.material.override({ ambient: 0, color: eye_color }) // Use maximum ambient and specified eye color
        );

        this.shapes.sphere.draw(
            context,
            program_state,
            right_white_eye_transform, // Scale the eye
            this.material.override({ ambient: 0.4, color: white }) // Use maximum ambient and specified eye color
        );

        this.shapes.sphere.draw(
            context,
            program_state,
            right_eye_transform, // Scale the eye
            this.material.override({ ambient: 0, color: eye_color }) // Use maximum ambient and specified eye color
        );

        this.shapes.sphere.draw(
            context,
            program_state,
            left_white_eye_transform, // Scale the eye
            this.material.override({ ambient: 0.4, color: white }) // Use maximum ambient and specified eye color
        );

        //walking implementation
        let head_transform = Mat4.identity();

        let body_transform = Mat4.translation(0,-2.4,0).times(Mat4.rotation(Math.PI / 2, 0, 1, 0));

        let leg1_transform = Mat4.translation(-0.3,-4.00,-0.22).times(Mat4.rotation(Math.PI / 2, 0, 1, 0));

        let leg2_transform = Mat4.translation(0.3,-4.00,-0.22).times(Mat4.rotation(Math.PI / 2, 0, 1, 0));

        let leg_rotation_factor = -2; //should be half the size of the head
        let leg_movement_height = .3; //how high the legs rotate upward while walking
        let leg_movement_speed = 5; //how quickly the legs oscillate while walking

        if (this.speed > 12.4) {
            leg_movement_speed = 9;
            leg_movement_height = .5;
        }
        else if (this.speed < 7.6) {
            leg_movement_speed = 1;
            leg_movement_height = .2;
        }

        if (this.control.s) {
            head_transform = Mat4.rotation(0, 0, 1, 0);
            body_transform = Mat4.rotation(0, 0, 1, 0).times(body_transform);
            leg1_transform = Mat4.translation(-.3,-2.0,0)
                .times(Mat4.rotation(leg_movement_height*Math.sin(leg_movement_speed*t), 1, 0, 0))
                .times(Mat4.translation(0,leg_rotation_factor,0)).times(Mat4.rotation(Math.PI / 2, 0, 1, 0));
            //translate wrt head first to obtain correct angle of rotation
            leg2_transform = Mat4.translation(.3,-2.0,0)
                .times(Mat4.rotation(-leg_movement_height*Math.sin(leg_movement_speed*t), 1, 0, 0))
                .times(Mat4.translation(0,leg_rotation_factor,0)).times(Mat4.rotation(Math.PI / 2, 0, 1, 0));
        }

        if (this.control.w) {
            head_transform = Mat4.rotation(Math.PI, 0, 1,  0);
            body_transform = Mat4.rotation(Math.PI, 0, 1,  0).times(body_transform);
            leg2_transform = Mat4.translation(-.3,-2.0,0)
                .times(Mat4.rotation(-leg_movement_height*Math.sin(leg_movement_speed*t), 1, 0, 0))
                .times(Mat4.translation(0,leg_rotation_factor,0)).times(Mat4.rotation(Math.PI * 3/2, 0, 1, 0));
            leg1_transform = Mat4.translation(.3,-2.0,0)
                .times(Mat4.rotation(leg_movement_height*Math.sin(leg_movement_speed*t), 1, 0, 0))
                .times(Mat4.translation(0,leg_rotation_factor,0)).times(Mat4.rotation(Math.PI * 3/2, 0, 1, 0));
        }

        if (this.control.a) {
            head_transform = Mat4.rotation(3/2*Math.PI, 0, 1, 0);
            body_transform = Mat4.rotation(3/2*Math.PI, 0, 1, 0).times(body_transform);
            leg1_transform = Mat4.translation(0,-2.0,-.3)
                .times(Mat4.rotation(-leg_movement_height*Math.sin(leg_movement_speed*t), 0, 0, 1))
                .times(Mat4.translation(0,leg_rotation_factor,0)).times(Mat4.rotation(0, 0, 1, 0));
            leg2_transform = Mat4.translation(0,-2.0,.3)
                .times(Mat4.rotation(leg_movement_height*Math.sin(leg_movement_speed*t), 0, 0, 1))
                .times(Mat4.translation(0,leg_rotation_factor,0)).times(Mat4.rotation(0, 0, 1, 0));
        }


        if (this.control.d) {
            head_transform = Mat4.rotation(1/2*Math.PI, 0, 1, 0);
            body_transform = Mat4.rotation(1/2*Math.PI, 0, 1, 0).times(body_transform);
            leg2_transform = Mat4.translation(0, -2.0, -.3)
                .times(Mat4.rotation(leg_movement_height * Math.sin(leg_movement_speed * t), 0, 0, 1))
                .times(Mat4.translation(0, leg_rotation_factor, 0)).times(Mat4.rotation(Math.PI, 0, 1, 0));
            leg1_transform = Mat4.translation(0, -2.0, .3)
                .times(Mat4.rotation(-leg_movement_height * Math.sin(leg_movement_speed * t), 0, 0, 1))
                .times(Mat4.translation(0, leg_rotation_factor, 0)).times(Mat4.rotation(Math.PI, 0, 1, 0));
        }

        this.body.draw(
            context,
            program_state,
            agent_trans.times(body_transform),
            this.material.override({ambient:.8, texture: this.data.textures.skin}),
        );



                this.leg.draw(
                    context,
                    program_state,
                    agent_trans.times(leg1_transform).times(Mat4.scale(0.7,0.9,0.7)),
                    this.material.override({ambient:.8, texture: this.data.textures.skin}),
                );

                this.leg.draw(
                    context,
                    program_state,
                    agent_trans.times(leg2_transform).times(Mat4.scale(0.7,0.9,0.7)),
                    this.material.override({ambient:.8, texture: this.data.textures.skin}),
                );


        let agent_trans2 = agent_trans.times(head_transform);

        this.agent.draw(
            context,
            program_state,
            agent_trans.times(head_transform),
            this.material.override({ambient:.8, texture: this.data.textures.skin})
        );

        this.hair.draw(context, program_state, agent_trans2.times(Mat4.translation(0,0.5,-0.2)),  this.material.override({ ambient: 0, color: eye_color }));
        this.smile.draw(context, program_state, agent_trans2.times(Mat4.translation(0,-0.3,-1.1).times(Mat4.scale(0.16,0.16,0.16))),  this.material.override({ ambient: 0.4, color: smile_color }));
        this.neck.draw(context, program_state, agent_trans2.times(Mat4.translation(0,-1,0).times(Mat4.scale(0.3,0.4,0.3))),  this.material.override({ambient:.8, texture: this.data.textures.skin}));


        //end of walking implementation
        /*
        this.clothing.dress.draw(
            context,
            program_state,
            agent_trans2.times(Mat4.translation(0,-2.5,-0.1)).times(Mat4.rotation(-Math.PI/1.7, 0, 1, 0)).times(Mat4.scale(1,1,1)),
            this.material.override({ambient: 0.5, texture: this.data.textures.dress1Texture})
        );

         */

        /*
        this.clothing.dress2.draw(
            context,
            program_state,
            agent_trans2.times(Mat4.translation(0,1.65,0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(6,6,7.5)),
            this.material.override({ambient: 0.5, texture: this.data.textures.dress2Texture})
        );

         */



        /*this.clothing.shirt1.draw(
            context,
            program_state,
            agent_trans2.times(Mat4.translation(0,-1.7,0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)),
            this.material.override({ambient: 0.5, texture: this.data.textures.shirt1Texture})
        );*/




        /*this.clothing.shirt3.draw(
            context,
            program_state,
            agent_trans2.times(Mat4.translation(0,-2,0)).times(Mat4.rotation(0, 0, 1, 0)).times(Mat4.scale(1,1,1)),
            this.material.override({ambient: 0.5, texture: this.data.textures.shirt1Texture})
        );*/


        this.clothing.shirt2.draw(
            context,
            program_state,
            agent_trans2.times(Mat4.translation(0,-2.5,0)).times(Mat4.rotation(0, 0, 1, 0)).times(Mat4.scale(1.2,1.2,1.2)),
            this.material.override({ambient: 0.5, texture: this.data.textures.shirt1Texture})
        );




        /*
        this.clothing.shirt4.draw(
            context,
            program_state,
            agent_trans2.times(
                Mat4.translation(0,-2.2,-0.3)
            ).times(
                Mat4.scale(1.2,1.2,3.6)
            ).times(
                Mat4.rotation(-Math.PI/2, 0, 1, 0)
            ),
            this.material.override({ambient: 0.5, texture: this.data.textures.dressTexture})
        );
`       */



        this.clothing.pant.draw(
            context,
            program_state,
            agent_trans2.times(
                Mat4.translation(0.3,-4,-0.2)
            ).times(
                Mat4.rotation(0, 0, 1, 0)
            ).times(
                Mat4.scale(0.4,0.6,0.8)
            ),
            this.material.override({ambient: 0.5, texture: this.data.textures.pant1Texture})
        );

        this.clothing.pant.draw(
            context,
            program_state,
            agent_trans2.times(
                Mat4.translation(-0.3,-4,-0.2)
            ).times(
                Mat4.rotation(0, 0, 1, 0)
            ).times(
                Mat4.scale(0.4,0.6,0.8)
            ),
            this.material.override({ambient: 0.5, texture: this.data.textures.dressTexture})
        );





        let clothingList = [this.clothing.dress, this.clothing.dress2, this.clothing.dress2, this.clothing.shirt1, this.clothing.shirt2, this.clothing.shirt3];
        let transformList = [agent_trans_s.times(Mat4.translation(0,-2.5,-0.1)).times(Mat4.rotation(-Math.PI/1.7, 0, 1, 0)).times(Mat4.scale(1,1,1)),
            agent_trans_s.times(Mat4.translation(0,1.65,0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(6,6,7.5)),
            agent_trans_s.times(Mat4.translation(0,1.65,0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(6,6,7.5)),
            agent_trans_s.times(Mat4.translation(0,-1.7,0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)),
            agent_trans_s.times(Mat4.translation(0,-2.5,0)).times(Mat4.rotation(0, 0, 1, 0)).times(Mat4.scale(1.2,1.2,1.2)),
            agent_trans_s.times(Mat4.translation(0,-2,0)).times(Mat4.rotation(0, 0, 1, 0)).times(Mat4.scale(1,1,1))]
        let textureList = [this.data.textures.dress1Texture, this.data.textures.dress2Texture,this.data.textures.dress3Texture,this.data.textures.shirt1Texture,this.data.textures.shirt2Texture,this.data.textures.shirt3Texture];
        let pantTextureList = [this.data.textures.pant1Texture, this.data.textures.pant2Texture, this.data.textures.pant2Texture];
        let i = 0;
        for (let x = -60; x <= 120; x += 60) {
            // Loop over z coordinates
            for (let z = 10; z <= 60; z += 50) {
                // Translate each stand to its position and draw it
                let stand_location = Mat4.translation(x, -4, z);
                this.stand.draw(
                    context,
                    program_state,
                    stand_location.times(Mat4.scale(5, 6, 5)),
                    this.material.override({ambient: 0.5, texture: this.data.textures.dress1Texture}),
                );
                //need a matrix of translations
                clothingList[i%6].draw(
                    context,
                    program_state,
                    Mat4.translation(x, 2, z).times(transformList[i%6]),
                    this.material.override({ambient: 0.5, texture: textureList[i%6]}),
                );

                if(i === 3 || i===4 || i === 5){
                    this.clothing.pant.draw(
                        context,
                        program_state,
                        Mat4.translation(x, 1, z).times(agent_trans_s).times(
                            Mat4.translation(0.3,-4,-0.2)
                        ).times(
                            Mat4.rotation(0, 0, 1, 0)
                        ).times(
                            Mat4.scale(0.4,0.6,0.8)
                        ),
                        this.material.override({ambient: 0.5, texture: pantTextureList[0]})
                    );


                    this.clothing.pant.draw(
                        context,
                        program_state,
                        Mat4.translation(x, 1, z).times(agent_trans_s).times(
                            Mat4.translation(-0.3,-4,-0.2)
                        ).times(
                            Mat4.rotation(0, 0, 1, 0)
                        ).times(
                            Mat4.scale(0.4,0.6,0.8)
                        ),
                        this.material.override({ambient: 0.5, texture: pantTextureList[0]})
                    );
                }
                i = i+1;
            }
        }

        /*
        this.clothing.dress.draw(
            context,
            program_state,
            Mat4.translation(x, -3, z).times(Mat4.scale(5, 5, 5)),
            this.material.override({ambient: 0.5, texture: this.data.textures.dressTexture}),
        ); */



        //this.stand.draw(context, program_state, Mat4.translation(-4,-4,0).times(Mat4.scale(4,4,4)),  this.material.override({ambient: 0.5, texture: this.data.textures.dressTexture}));
        //this.stand.draw(context, program_state,Mat4.translation(4,-4.4,0),  this.material.override({ambient: 0.5, texture: this.data.textures.dressTexture}));


        /*
        // Draw the rectangle
        const rectangle_transform = Mat4.translation(0, 0, -1).times(Mat4.scale(2, 1, 1)); // Position and scale the rectangle
        this.shapes.square.draw(context, program_state, rectangle_transform, eye_color);

        // Draw the text "Fashion Show" on the front side of the rectangle
        const text_transform = Mat4.translation(-0.5, 0.5, -1).times(Mat4.scale(0.1, 0.1, 0.1)); // Position and scale the text
        let string = "Fashion Show";
        this.shapes.text.set_string(string, context.context);
        this.shapes.text.draw(context, program_state, text_transform, this.text_image);

         */

        /*
        let agent_loc =  Mat4.translation(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2]);
        let agent_trans = Mat4.translation(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2]).times(Mat4.rotation(Math.PI, 0, 1, 0)) // Rotate 180 degrees around the y-axis.times(Mat4.scale(this.agent_size,this.agent_size,this.agent_size));

        const eye_radius = 0.2; // Radius of the eyes
        const eye_offset = 3.7; // Offset of the eyes from the center of the head
        let eye_color = color(0,0,0,1);
        let left_eye_transform = Mat4.translation(-eye_offset , -4.2, 3).times(Mat4.scale(0.15,0.15,0.15).times(agent_trans));
        //let left_eye_transform =Mat4.translation(-eye_offset , -0.1, 2).times(Mat4.scale(eye_radius, eye_radius*1.2, eye_radius)).times(agent_loc);
        const right_eye_transform = agent_loc.times(Mat4.translation(eye_offset , -0.1, 2).times(Mat4.scale(eye_radius, eye_radius*1.2, eye_radius))); // Translate right eye



        this.agent.draw(context, program_state, agent_trans, this.new_material);
        this.shapes.sphere.draw(
            context,
            program_state,
            left_eye_transform, // Scale the eye
            this.material.override({ambient: 1, color: eye_color}) // Use maximum ambient and specified eye color
        );

         */





    }

    // show_explanation(document_element) {
    //     document_element.innerHTML += `<p>This demo lets random initial momentums carry bodies until they fall and bounce.  It shows a good way to do incremental movements, which are crucial for making objects look like they're moving on their own instead of following a pre-determined path.  Animated objects look more real when they have inertia and obey physical laws, instead of being driven by simple sinusoids or periodic functions.
    //                                  </p><p>For each moving object, we need to store a model matrix somewhere that is permanent (such as inside of our class) so we can keep consulting it every frame.  As an example, for a bowling simulation, the ball and each pin would go into an array (including 11 total matrices).  We give the model transform matrix a \"velocity\" and track it over time, which is split up into linear and angular components.  Here the angular velocity is expressed as an Euler angle-axis pair so that we can scale the angular speed how we want it.
    //                                  </p><p>The forward Euler method is used to advance the linear and angular velocities of each shape one time-step.  The velocities are not subject to any forces here, but just a downward acceleration.  Velocities are also constrained to not take any objects under the ground plane.
    //                                  </p><p>This scene extends class Simulation, which carefully manages stepping simulation time for any scenes that subclass it.  It totally decouples the whole simulation from the frame rate, following the suggestions in the blog post <a href=\"https://gafferongames.com/post/fix_your_timestep/\" target=\"blank\">\"Fix Your Timestep\"</a> by Glenn Fielder.  Buttons allow you to speed up and slow down time to show that the simulation's answers do not change.</p>`;
    // }
}