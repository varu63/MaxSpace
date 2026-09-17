/*
============================================================
MAXSPACE-PRO LEGACY MIRROR (schema only)

Replicates the entire maxvolt_prod (the "maxspace-pro" source)
schema inside maxspace_db under the dedicated schema
"maxspace_pro" so the authoritative legacy data co-exists with
the MaxSpace app tables (public.users / batteries / services /
profiles / service_persons).

Data copy (repeatable):
  docker exec maxspace-postgres pg_dump -U maxspace_user -d maxvolt_prod --format=plain --no-owner --no-privileges -f /tmp/maxvolt_full.sql
  docker exec maxspace-postgres sed -i 's/public\./maxspace_pro./g' /tmp/maxvolt_full.sql
  docker exec maxspace-postgres psql -U maxspace_user -d maxspace_db -f /tmp/maxvolt_full.sql
============================================================
*/
CREATE SCHEMA IF NOT EXISTS maxspace_pro;

--
-- PostgreSQL database dump
--

\restrict SjrLKS1rA7jq9gYopARchmVcFp1KvhLpqKjRbbcOgLum4oJGMnFnHhxT8Uz1Oah

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: celltype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE maxspace_pro.celltype AS ENUM (
    'NMC',
    'LFP'
);


--
-- Name: weldingtype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE maxspace_pro.weldingtype AS ENUM (
    'LASER',
    'SPOT'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: batteries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.batteries (
    battery_id character varying NOT NULL,
    model_id character varying NOT NULL,
    had_ng_status boolean,
    overall_status character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    cell_ir_lower double precision,
    cell_ir_upper double precision,
    cell_voltage_lower double precision,
    cell_voltage_upper double precision,
    cell_capacity_lower double precision,
    cell_capacity_upper double precision
);


--
-- Name: battery_cell_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.battery_cell_mapping (
    battery_id character varying NOT NULL,
    cell_id character varying NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


--
-- Name: battery_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.battery_models (
    model_id character varying NOT NULL,
    category character varying NOT NULL,
    series_count integer NOT NULL,
    parallel_count integer NOT NULL,
    cell_type maxspace_pro.celltype NOT NULL,
    bms_model character varying,
    welding_type maxspace_pro.weldingtype NOT NULL
);


--
-- Name: bms_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.bms_inventory (
    bms_id character varying NOT NULL,
    battery_id character varying,
    is_used boolean,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: cell_gradings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.cell_gradings (
    id integer NOT NULL,
    cell_id character varying(100),
    test_date timestamp without time zone,
    lot character varying(100),
    brand character varying(100),
    specification character varying(255),
    ocv_voltage_mv double precision,
    upper_cutoff_mv double precision,
    lower_cutoff_mv double precision,
    discharging_capacity_mah double precision,
    result character varying(50),
    final_soc_mah double precision,
    soc_result character varying(50),
    final_cv_capacity double precision,
    final_result character varying(50)
);


--
-- Name: cell_gradings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.cell_gradings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cell_gradings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.cell_gradings_id_seq OWNED BY maxspace_pro.cell_gradings.id;


--
-- Name: cells; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.cells (
    cell_id character varying(100) NOT NULL,
    registration_date timestamp with time zone DEFAULT now(),
    is_used boolean,
    status character varying(50),
    ng_count integer,
    discharging_capacity_mah double precision,
    last_test_date timestamp without time zone,
    ir_value_m_ohm double precision,
    sorting_voltage double precision,
    sorting_date timestamp without time zone
);


--
-- Name: dispatch_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.dispatch_records (
    id integer NOT NULL,
    battery_id character varying,
    customer_name character varying(255) NOT NULL,
    invoice_id character varying(100) NOT NULL,
    invoice_date date NOT NULL,
    dispatch_timestamp timestamp with time zone DEFAULT now()
);


--
-- Name: dispatch_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.dispatch_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispatch_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.dispatch_records_id_seq OWNED BY maxspace_pro.dispatch_records.id;


--
-- Name: laser_welding_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.laser_welding_data (
    id integer NOT NULL,
    battery_id character varying,
    initial_speed double precision,
    max_speed double precision,
    acceleration double precision,
    laser_on_delay integer,
    laser_off_delay integer,
    point_duration integer,
    power_mode character varying(50),
    pwm_freq integer,
    pwm_cycle integer,
    pwm_duty_rate double precision,
    pwm_width double precision,
    code integer,
    dac_power double precision,
    scan_speed double precision,
    lsm_laser_on_delay integer,
    lsm_laser_off_delay integer,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: laser_welding_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.laser_welding_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: laser_welding_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.laser_welding_data_id_seq OWNED BY maxspace_pro.laser_welding_data.id;


--
-- Name: pack_testing_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.pack_testing_reports (
    id integer NOT NULL,
    battery_id character varying,
    test_date timestamp without time zone,
    specification character varying(255),
    cell_type character varying(100),
    actual_cap double precision,
    ocv_voltage double precision,
    upper_cutoff double precision,
    lower_cutoff double precision,
    discharging_capacity double precision,
    capacity_result character varying(50),
    idle_difference double precision,
    idle_diff_res character varying(50),
    final_voltage double precision,
    final_result character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    soc_result character varying(50),
    number_of_series integer DEFAULT 0,
    number_of_parallel integer DEFAULT 0
);


--
-- Name: pack_testing_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.pack_testing_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pack_testing_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.pack_testing_reports_id_seq OWNED BY maxspace_pro.pack_testing_reports.id;


--
-- Name: pdi_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.pdi_reports (
    id integer NOT NULL,
    battery_id character varying,
    test_time timestamp without time zone,
    voltage_v double precision,
    resistance_m_ohm double precision,
    cont_charging_current double precision,
    cont_charging_voltage double precision,
    cont_discharging_current double precision,
    cont_discharging_voltage double precision,
    short_circuit_prot_time_us integer,
    test_result character varying(100),
    updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pdi_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.pdi_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdi_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.pdi_reports_id_seq OWNED BY maxspace_pro.pdi_reports.id;


--
-- Name: spot_welding_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.spot_welding_data (
    id integer NOT NULL,
    battery_id character varying,
    solder_joint_mode character varying(100),
    welding_needle_direction character varying(100),
    hole_setback_distance double precision,
    total_stroke_welding_head double precision,
    start_delay integer,
    clamping_delay integer,
    welding_time integer,
    air_speed double precision,
    working_speed double precision,
    hole_inlet_speed double precision,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: spot_welding_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.spot_welding_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: spot_welding_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.spot_welding_data_id_seq OWNED BY maxspace_pro.spot_welding_data.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE maxspace_pro.users (
    id integer NOT NULL,
    username character varying NOT NULL,
    hashed_password character varying NOT NULL,
    full_name character varying NOT NULL,
    assigned_roles json NOT NULL,
    is_active boolean,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE maxspace_pro.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE maxspace_pro.users_id_seq OWNED BY maxspace_pro.users.id;


--
-- Name: cell_gradings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.cell_gradings ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.cell_gradings_id_seq'::regclass);


--
-- Name: dispatch_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.dispatch_records ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.dispatch_records_id_seq'::regclass);


--
-- Name: laser_welding_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.laser_welding_data ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.laser_welding_data_id_seq'::regclass);


--
-- Name: pack_testing_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pack_testing_reports ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.pack_testing_reports_id_seq'::regclass);


--
-- Name: pdi_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pdi_reports ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.pdi_reports_id_seq'::regclass);


--
-- Name: spot_welding_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.spot_welding_data ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.spot_welding_data_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.users ALTER COLUMN id SET DEFAULT nextval('maxspace_pro.users_id_seq'::regclass);


--
-- Name: batteries batteries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.batteries
    ADD CONSTRAINT batteries_pkey PRIMARY KEY (battery_id);


--
-- Name: battery_cell_mapping battery_cell_mapping_cell_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.battery_cell_mapping
    ADD CONSTRAINT battery_cell_mapping_cell_id_key UNIQUE (cell_id);


--
-- Name: battery_cell_mapping battery_cell_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.battery_cell_mapping
    ADD CONSTRAINT battery_cell_mapping_pkey PRIMARY KEY (battery_id, cell_id);


--
-- Name: battery_models battery_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.battery_models
    ADD CONSTRAINT battery_models_pkey PRIMARY KEY (model_id);


--
-- Name: bms_inventory bms_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.bms_inventory
    ADD CONSTRAINT bms_inventory_pkey PRIMARY KEY (bms_id);


--
-- Name: cell_gradings cell_gradings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.cell_gradings
    ADD CONSTRAINT cell_gradings_pkey PRIMARY KEY (id);


--
-- Name: cells cells_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.cells
    ADD CONSTRAINT cells_pkey PRIMARY KEY (cell_id);


--
-- Name: dispatch_records dispatch_records_battery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.dispatch_records
    ADD CONSTRAINT dispatch_records_battery_id_key UNIQUE (battery_id);


--
-- Name: dispatch_records dispatch_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.dispatch_records
    ADD CONSTRAINT dispatch_records_pkey PRIMARY KEY (id);


--
-- Name: laser_welding_data laser_welding_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.laser_welding_data
    ADD CONSTRAINT laser_welding_data_pkey PRIMARY KEY (id);


--
-- Name: pack_testing_reports pack_testing_reports_battery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pack_testing_reports
    ADD CONSTRAINT pack_testing_reports_battery_id_key UNIQUE (battery_id);


--
-- Name: pack_testing_reports pack_testing_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pack_testing_reports
    ADD CONSTRAINT pack_testing_reports_pkey PRIMARY KEY (id);


--
-- Name: pdi_reports pdi_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pdi_reports
    ADD CONSTRAINT pdi_reports_pkey PRIMARY KEY (id);


--
-- Name: spot_welding_data spot_welding_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.spot_welding_data
    ADD CONSTRAINT spot_welding_data_pkey PRIMARY KEY (id);


--
-- Name: cell_gradings uq_cell_grading_cell_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.cell_gradings
    ADD CONSTRAINT uq_cell_grading_cell_id UNIQUE (cell_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_batteries_battery_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_batteries_battery_id ON maxspace_pro.batteries USING btree (battery_id);


--
-- Name: ix_batteries_overall_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_batteries_overall_status ON maxspace_pro.batteries USING btree (overall_status);


--
-- Name: ix_battery_models_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_battery_models_model_id ON maxspace_pro.battery_models USING btree (model_id);


--
-- Name: ix_bms_inventory_bms_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bms_inventory_bms_id ON maxspace_pro.bms_inventory USING btree (bms_id);


--
-- Name: ix_cell_brand_test_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cell_brand_test_date ON maxspace_pro.cell_gradings USING btree (brand, test_date);


--
-- Name: ix_cell_grading_final_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cell_grading_final_result ON maxspace_pro.cell_gradings USING btree (final_result);


--
-- Name: ix_cell_gradings_cell_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cell_gradings_cell_id ON maxspace_pro.cell_gradings USING btree (cell_id);


--
-- Name: ix_cell_gradings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cell_gradings_id ON maxspace_pro.cell_gradings USING btree (id);


--
-- Name: ix_cells_cell_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cells_cell_id ON maxspace_pro.cells USING btree (cell_id);


--
-- Name: ix_dispatch_records_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dispatch_records_id ON maxspace_pro.dispatch_records USING btree (id);


--
-- Name: ix_laser_welding_data_battery_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_laser_welding_data_battery_id ON maxspace_pro.laser_welding_data USING btree (battery_id);


--
-- Name: ix_laser_welding_data_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_laser_welding_data_id ON maxspace_pro.laser_welding_data USING btree (id);


--
-- Name: ix_mapping_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mapping_lookup ON maxspace_pro.battery_cell_mapping USING btree (battery_id, cell_id);


--
-- Name: ix_pack_testing_reports_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pack_testing_reports_id ON maxspace_pro.pack_testing_reports USING btree (id);


--
-- Name: ix_pdi_reports_battery_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pdi_reports_battery_id ON maxspace_pro.pdi_reports USING btree (battery_id);


--
-- Name: ix_pdi_reports_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pdi_reports_id ON maxspace_pro.pdi_reports USING btree (id);


--
-- Name: ix_spot_welding_data_battery_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_spot_welding_data_battery_id ON maxspace_pro.spot_welding_data USING btree (battery_id);


--
-- Name: ix_spot_welding_data_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_spot_welding_data_id ON maxspace_pro.spot_welding_data USING btree (id);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON maxspace_pro.users USING btree (id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_username ON maxspace_pro.users USING btree (username);


--
-- Name: batteries batteries_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.batteries
    ADD CONSTRAINT batteries_model_id_fkey FOREIGN KEY (model_id) REFERENCES maxspace_pro.battery_models(model_id);


--
-- Name: battery_cell_mapping battery_cell_mapping_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.battery_cell_mapping
    ADD CONSTRAINT battery_cell_mapping_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id) ON DELETE CASCADE;


--
-- Name: battery_cell_mapping battery_cell_mapping_cell_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.battery_cell_mapping
    ADD CONSTRAINT battery_cell_mapping_cell_id_fkey FOREIGN KEY (cell_id) REFERENCES maxspace_pro.cells(cell_id);


--
-- Name: bms_inventory bms_inventory_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.bms_inventory
    ADD CONSTRAINT bms_inventory_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id);


--
-- Name: cell_gradings cell_gradings_cell_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.cell_gradings
    ADD CONSTRAINT cell_gradings_cell_id_fkey FOREIGN KEY (cell_id) REFERENCES maxspace_pro.cells(cell_id);


--
-- Name: dispatch_records dispatch_records_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.dispatch_records
    ADD CONSTRAINT dispatch_records_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id);


--
-- Name: laser_welding_data laser_welding_data_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.laser_welding_data
    ADD CONSTRAINT laser_welding_data_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id);


--
-- Name: pack_testing_reports pack_testing_reports_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pack_testing_reports
    ADD CONSTRAINT pack_testing_reports_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id);


--
-- Name: pdi_reports pdi_reports_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.pdi_reports
    ADD CONSTRAINT pdi_reports_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id);


--
-- Name: spot_welding_data spot_welding_data_battery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY maxspace_pro.spot_welding_data
    ADD CONSTRAINT spot_welding_data_battery_id_fkey FOREIGN KEY (battery_id) REFERENCES maxspace_pro.batteries(battery_id);


--
-- PostgreSQL database dump complete
--

\unrestrict SjrLKS1rA7jq9gYopARchmVcFp1KvhLpqKjRbbcOgLum4oJGMnFnHhxT8Uz1Oah


