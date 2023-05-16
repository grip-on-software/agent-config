pipeline {
    agent { label 'axe' }

    environment {
        IMAGE = "gros-agent-config"
        IMAGE_TAG = env.BRANCH_NAME.replaceFirst('^master$', 'latest')
        GITLAB_TOKEN = credentials('agent-config-gitlab-token')
        SCANNER_HOME = tool name: 'SonarQube Scanner 3', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
    }

    options {
        gitLabConnection('gitlab')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    triggers {
        gitlab(triggerOnPush: true, triggerOnMergeRequest: true, branchFilterType: 'All', secretToken: env.GITLAB_TOKEN)
        cron('H H * * H/3')
    }

    post {
        failure {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'failed'
        }
        aborted {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'canceled'
        }
        always {
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, includes: 'junit/**/*,html/**/*', keepAll: false, reportDir: 'test-report', reportFiles: 'html/htmlReport.html', reportName: 'Test Report', reportTitles: ''])
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'coverage', reportFiles: 'lcov-report/index.html', reportName: 'Coverage', reportTitles: ''])
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: true, keepAll: false, reportDir: 'owasp-dep/', reportFiles: 'dependency-check-report.html', reportName: 'Dependencies', reportTitles: ''])
            archiveArtifacts artifacts: 'accessibility.csv,schema/**/*.json', excludes: '', onlyIfSuccessful: true
            junit 'test-report/junit/*.xml'
        }
    }

    stages {
        stage('Start') {
            when {
                not {
                    triggeredBy 'TimerTrigger'
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'running'
            }
        }
        stage('Build') {
            steps {
                checkout scm
                withCredentials([file(credentialsId: 'agent-web-config', variable: 'AGENT_CONFIGURATION'), file(credentialsId: 'upload-server-certificate', variable: 'SERVER_CERTIFICATE')]) {
                    sh 'cp $AGENT_CONFIGURATION config.json'
                    sh 'cp $SERVER_CERTIFICATE wwwgros.crt'
                    sh 'docker build -t $DOCKER_REPOSITORY/$IMAGE:$IMAGE_TAG . --build-arg NODE_ENV=production'
                    sh 'docker push $DOCKER_REPOSITORY/$IMAGE:$IMAGE_TAG'
                }
            }
        }
        stage('Test preconfigure') {
            steps {
                sh 'mkdir cert'
                sh 'openssl genrsa -out cert/server.key 2048'
                sh 'openssl rsa -in cert/server.key -out cert/server.crt.key'
                sh 'openssl req -sha256 -new -key cert/server.crt.key -out cert/server.csr -subj /CN=localhost'
                sh 'openssl x509 -req -sha256 -days 365 -in cert/server.csr -signkey cert/server.crt.key -out cert/server.crt'
            }
        }
        stage('Test') {
            agent {
                docker {
                    image "${env.IMAGE}:${env.IMAGE_TAG}"
                    registryUrl "${env.DOCKER_URL}"
                    registryCredentialsId 'docker-credentials'
                    reuseNode true
                }
            }
            steps {
                sh 'NODE_ENV=development npm install --cache .npm && npm run lint'
                sh 'SPAWN_WRAP_SHIM_ROOT=. LISTEN_ADDR= SSH_HTTPS_PORT=8443 SSH_HTTPS_CERT=cert/server.crt SSH_HOST=localhost AGENT_PORT=7070 AGENT_HOST=localhost UPDATE_TIMEOUT=100 SCRAPE_TIMEOUT=100 npm test || true'
            }
        }
        stage('Dependency Check') {
            steps {
                dir('security') {
                    checkout changelog: false, poll: false, scm: [$class: 'GitSCM', branches: [[name: '*/master']], doGenerateSubmoduleConfigurations: false, extensions: [[$class: 'CleanBeforeCheckout']], submoduleCfg: [], userRemoteConfigs: [[url: 'https://github.com/ICTU/security-tooling']]]
                    sh 'sed -i "s/\\r$//" *.sh'
                    sh 'cp ../tests/suppression.xml suppression.xml'
                    sh 'mkdir -p -m 0777 "$HOME/OWASP-Dependency-Check/data/cache"'
                    sh 'mkdir -p -m 0777 "$WORKSPACE/owasp-dep"'
                    sh 'sed -i "s/\\(--out \\/report\\)/--exclude \\"**\\/.git\\/**\\" --exclude \\"**\\/.npm\\/**\\" --exclude \\"**\\/.nyc_output\\/**\\" --exclude \\"**\\/coverage\\/**\\" --exclude \\"**\\/test-*\\/**\\" --project \\"Agent config\\" \\1/" security_dependencycheck.sh'
                    sh 'bash ./security_dependencycheck.sh "$WORKSPACE" "$WORKSPACE/owasp-dep"'
                }
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '${SCANNER_HOME}/bin/sonar-scanner -Dsonar.projectKey=agent-config:$BRANCH_NAME -Dsonar.projectName="Agent configuration $BRANCH_NAME"'
                }
            }
        }
        stage('Push') {
            when { branch 'master' }
            steps {
                sh 'grep ".version.:" package.json | sed -E "s/^.*.version.: .([0-9.]+).,/\\1/" > .version'
                sh 'docker tag $DOCKER_REPOSITORY/$IMAGE:latest $DOCKER_REPOSITORY/$IMAGE:$(cat .version)'
                sh 'docker push $DOCKER_REPOSITORY/$IMAGE:$(cat .version)'
            }
        }
        stage('Status') {
            when {
                not {
                    triggeredBy 'TimerTrigger'
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'success'
            }
        }
    }
}
