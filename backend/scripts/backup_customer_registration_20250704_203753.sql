--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255),
    is_domain_verified boolean DEFAULT false,
    subscription_type character varying(50) DEFAULT 'trial'::character varying,
    trial_expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.companies_id_seq OWNER TO postgres;

--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: trial_limitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trial_limitations (
    id integer NOT NULL,
    company_id integer,
    max_users integer DEFAULT 5,
    max_projects integer DEFAULT 3,
    max_storage_mb integer DEFAULT 1000,
    features_enabled jsonb DEFAULT '{"basic": true, "premium": false, "advanced": false}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.trial_limitations OWNER TO postgres;

--
-- Name: trial_limitations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trial_limitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trial_limitations_id_seq OWNER TO postgres;

--
-- Name: trial_limitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trial_limitations_id_seq OWNED BY public.trial_limitations.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(20),
    company_id integer,
    is_email_verified boolean DEFAULT false,
    email_verification_token character varying(255),
    email_verification_expires timestamp without time zone,
    terms_accepted boolean DEFAULT false,
    terms_accepted_at timestamp without time zone,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: trial_limitations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trial_limitations ALTER COLUMN id SET DEFAULT nextval('public.trial_limitations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, domain, is_domain_verified, subscription_type, trial_expires_at, created_at) FROM stdin;
1	TestCompany	consuleventinc.com	f	trial	2025-08-03 19:20:08.956	2025-07-04 19:20:08.956697
\.


--
-- Data for Name: trial_limitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trial_limitations (id, company_id, max_users, max_projects, max_storage_mb, features_enabled, created_at) FROM stdin;
1	1	5	3	1000	{"basic": true, "premium": false, "advanced": false}	2025-07-04 19:20:08.956697
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, first_name, last_name, phone, company_id, is_email_verified, email_verification_token, email_verification_expires, terms_accepted, terms_accepted_at, last_login, created_at) FROM stdin;
1	tapas.g@consuleventinc.com	$2b$12$hIpKmYppv772xesGpH2S1OYl.lXgWpzboLWgislJont2ZFndmELWO	Yogi	Garg		1	t	\N	\N	t	2025-07-04 19:20:08.968	2025-07-04 19:20:39.965518	2025-07-04 19:20:08.956697
\.


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.companies_id_seq', 1, true);


--
-- Name: trial_limitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trial_limitations_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: trial_limitations trial_limitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trial_limitations
    ADD CONSTRAINT trial_limitations_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: trial_limitations trial_limitations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trial_limitations
    ADD CONSTRAINT trial_limitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- PostgreSQL database dump complete
--

