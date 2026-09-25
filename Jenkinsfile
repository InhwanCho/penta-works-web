pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    triggers {
        // GitHub Repository webhook: POST /github-webhook/
        githubPush()
    }

    stages {
        stage('Checkout dev') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/dev']],
                    userRemoteConfigs: [[url: 'https://github.com/InhwanCho/penta-works-web.git']]
                ])
            }
        }

        stage('Deploy dev') {
            steps {
                withCredentials([string(credentialsId: 'mreyes-office-api-key', variable: 'PENTA_OFFICE_API_KEY')]) {
                    sh '''
                        set +x
                        printf '%s\\n' "$PENTA_OFFICE_API_KEY" | \
                          ssh -i "$HOME/.ssh/id_ed25519" -o BatchMode=yes -o StrictHostKeyChecking=yes \
                          inhwan@192.168.0.210 '
                            set -eu
                            IFS= read -r secret
                            env_file=/home/inhwan/pentaworks-secrets/.env
                            key_name=OFFICE_API_KEY
                            test -n "$secret"
                            temp_file=$(mktemp)
                            sed "/^${key_name}=/d" "$env_file" > "$temp_file"
                            printf "%s=%s\\n" "$key_name" "$secret" >> "$temp_file"
                            install -m 600 "$temp_file" "$env_file"
                            rm -f "$temp_file"
                          '
                        ssh -i "$HOME/.ssh/id_ed25519" \
                          -o BatchMode=yes \
                          -o StrictHostKeyChecking=yes \
                          inhwan@192.168.0.210 \
                          'bash -s -- dev' < deploy/refresh-and-deploy.sh
                    '''
                }
            }
        }
    }

    post {
        always {
            deleteDir()
        }
    }
}
