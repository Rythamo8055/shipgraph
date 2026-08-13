"""ShipGraph schema constants - single source of truth for node/rel types.

Relationship types and labels are ONLY interpolated from here into Cypher.
All user/query values are always $parameters.
"""

NODE_LABELS = ["Engineer", "Repo", "PullRequest", "Commit", "Release", "Incident", "Service"]

KEYS = {
    "Engineer": "login",
    "Repo": "name",
    "PullRequest": "key",
    "Commit": "key",
    "Release": "key",
    "Incident": "key",
    "Service": "key",
}

# Long-form aliases consumed by tests (test_db_live, test_data_quality) and
# audit_model.py. From one source: NODE_LABELS/KEYS above.
NODE_KEYS = KEYS
N_ENGINEER = "Engineer"
N_REPO = "Repo"
N_PULL_REQUEST = "PullRequest"
N_COMMIT = "Commit"
N_RELEASE = "Release"
N_INCIDENT = "Incident"
N_SERVICE = "Service"

REL_TYPES = [
    "AUTHORED", "COMMITTED", "OPENED", "MERGED_BY", "IMPROVED",
    "INCLUDED", "SHIPPED", "DEPLOYED", "AFFECTED", "RESOLVED_BY", "WORKED_ON",
]

R_SHIPPED = "SHIPPED"
R_DEPLOYED = "DEPLOYED"
R_RESOLVED_BY = "RESOLVED_BY"
R_WORKED_ON = "WORKED_ON"

HEURISTIC_RELS = {"SHIPPED", "DEPLOYED", "RESOLVED_BY", "WORKED_ON"}

# Unique-constraint statements, one per node label key; idempotent.
CONSTRAINT_CYPHER = [
    "CREATE CONSTRAINT %s_key_unique IF NOT EXISTS FOR (n:%s) REQUIRE n.%s IS UNIQUE"
    % (label.lower(), label, key)
    for label, key in KEYS.items()
]

# deterministic repo -> (source, component_name) service mapping.
# Reviewable on purpose (CONTRACT: "mapping MUST be deterministic, hardcoded"):
# - hashicorp/terraform + packer run HashiCorp's own HCP platform
# - the Vite toolchain is built by Vercel's team; vercel|Builds is the product
#   area its releases deploy into. Other repos stay unmapped: no statuspage
#   component in the dataset plausibly matches them, and unmapped is honest.
SERVICE_MAPPING = {
    "hashicorp/terraform": ("hashicorp", "HCP Terraform"),
    "hashicorp/packer": ("hashicorp", "HCP Packer"),
    "vitejs/vite": ("vercel", "Builds"),
    "vitejs/create-vite": ("vercel", "Builds"),
    "vitejs/vite-plugin-react": ("vercel", "Builds"),
    "vitejs/vite-plugin-vue": ("vercel", "Builds"),
}

ORG_REPOS = {
    "expressjs": ["express", "body-parser", "morgan", "cors", "serve-static"],
    "debug-js": ["debug"],
    "vitejs": ["vite", "vite-plugin-react", "rolldown-vite", "vite-plugin-vue"],
    "hashicorp": ["terraform", "vault", "consul", "packer", "nomad"],
}

STATUSPAGES = {
    "github": "www.githubstatus.com",
    "vercel": "www.vercel-status.com",
    "figma": "status.figma.com",
    "1password": "status.1password.com",
    "supabase": "status.supabase.com",
    "atlassian": "status.atlassian.com",
    "linear": "linearstatus.com",
    "hashicorp": "status.hashicorp.com",
}

MAX_PRS_PER_REPO = 150      # newest merged PRs
MAX_RELEASES_PER_REPO = 120
MAX_COMMITS_PER_PR = 50
MAX_CONTRIBUTORS = 40       # per repo, top by contributions
BODY_TRUNCATE = 200
MAX_TEXT = BODY_TRUNCATE    # alias consumed by tests