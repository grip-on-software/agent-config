pipeline {
    agent { label 'docker' }

    environment {
        IMAGE = "${env.DOCKER_REGISTRY}/gros-agent-config"
        IMAGE_TAG = env.BRANCH_NAME.replaceFirst('^master$', 'latest')
        SCANNER_HOME = tool name: 'SonarQube Scanner 3', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
    }

    options {
        gitLabConnection('gitlab')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    triggers {
        gitlab(triggerOnPush: true, triggerOnMergeRequest: true, branchFilterType: 'All')
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
            archiveArtifacts artifacts: 'accessibility.csv', excludes: '', onlyIfSuccessful: true
            junit 'test-report/junit/*.xml'
        }
    }

    stages {
        stage('Start') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
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
                    sh 'docker build -t $IMAGE:$IMAGE_TAG . --build-arg NODE_ENV=production'
                    sh 'docker push $IMAGE:$IMAGE_TAG'
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
                    image '$IMAGE:$IMAGE_TAG'
                    reuseNode true
                }
            }
            steps {
                sh 'NODE_ENV=development npm install && npm run lint'
                sh 'LISTEN_ADDR= SSH_HTTPS_PORT=8443 SSH_HTTPS_CERT=cert/server.crt SSH_HOST=localhost AGENT_PORT=7070 AGENT_HOST=localhost UPDATE_TIMEOUT=100 SCRAPE_TIMEOUT=100 npm test'
            }
        }
        stage('Dependency Check') {
            steps {
                dir('security-tooling') {
                    checkout changelog: false, poll: false, scm: [$class: 'GitSCM', branches: [[name: '*/master']], doGenerateSubmoduleConfigurations: false, extensions: [[$class: 'CleanBeforeCheckout']], submoduleCfg: [], userRemoteConfigs: [[url: 'https://github.com/ICTU/security-tooling']]]
                    sh 'sed -i "s/\\r$//" *.sh'
                    sh 'cp ../tests/suppression.xml suppression.xml'
                    sh 'sed -i "s/\\(:\\/tmp\\/src\\)/\\1 -v dependency-check-data:\\/tmp\\/dependency-check\\/data/" ./security_dependencycheck.sh'
                    sh 'bash ./security_dependencycheck.sh "$WORKSPACE" "$WORKSPACE/owasp-dep" --exclude "**/.git/**"'
                }
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '${SCANNER_HOME}/bin/sonar-scanner -Dsonar.branch=$BRANCH_NAME'
                }
            }
        }
        stage('Push') {
            when { branch 'master' }
            steps {
                sh 'grep ".version.:" package.json | sed -E "s/^.*.version.: .([0-9.]+).,/\\1/" > .version'
                sh 'docker tag $IMAGE:latest $IMAGE:$(cat .version)'
                sh 'docker push $IMAGE:$(cat .version)'
            }
        }
        stage('Status') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'success'
            }
        }
    }
}
